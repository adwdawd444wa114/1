const { spawn, exec } = require('child_process');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

/**
 * Docker容器管理器
 * 为每个用户创建独立的Docker容器
 */
class ContainerManager extends EventEmitter {
  constructor() {
    super();
    
    // 容器配置
    this.containerConfig = {
      // 基础镜像
      baseImage: 'ubuntu:22.04',
      
      // 容器资源限制
      limits: {
        memory: '512m',        // 内存限制
        cpus: '0.5',          // CPU限制
        pids: 100,            // 进程数限制
        diskQuota: '1g'       // 磁盘配额
      },
      
      // 网络配置
      network: {
        mode: 'bridge',       // 网络模式
        publishPorts: false   // 不暴露端口
      },
      
      // 安全配置
      security: {
        readOnly: false,      // 允许写入（在容器内）
        noNewPrivileges: true, // 禁止提权
        user: 'webssh:webssh', // 运行用户
        dropCaps: [           // 移除的能力
          'SYS_ADMIN',
          'SYS_MODULE', 
          'SYS_RAWIO',
          'SYS_TIME',
          'NET_ADMIN',
          'NET_RAW'
        ]
      },
      
      // 容器生命周期
      lifecycle: {
        autoRemove: true,     // 退出时自动删除
        timeout: 3600,       // 1小时超时
        restartPolicy: 'no'   // 不自动重启
      }
    };
    
    // 活跃容器列表 {userId: {containerId, containerName, createdAt, lastActivity}}
    this.activeContainers = new Map();
    
    // 检查Docker是否可用
    this.checkDockerAvailability();
    
    // 启动清理任务
    this.startCleanupTasks();
  }

  /**
   * 检查Docker是否可用
   */
  async checkDockerAvailability() {
    try {
      await this.execCommand('docker --version');
      console.log('✅ Docker已就绪');
      
      // 检查基础镜像
      await this.ensureBaseImage();
    } catch (error) {
      console.error('❌ Docker不可用:', error.message);
      console.log('请确保Docker已安装并正在运行');
      process.exit(1);
    }
  }

  /**
   * 确保基础镜像存在
   */
  async ensureBaseImage() {
    try {
      // 检查镜像是否存在
      await this.execCommand(`docker image inspect ${this.containerConfig.baseImage}`);
      console.log(`✅ 基础镜像 ${this.containerConfig.baseImage} 已就绪`);
    } catch (error) {
      console.log(`📥 正在拉取基础镜像 ${this.containerConfig.baseImage}...`);
      try {
        await this.execCommand(`docker pull ${this.containerConfig.baseImage}`);
        console.log('✅ 基础镜像拉取完成');
      } catch (pullError) {
        console.error('❌ 拉取基础镜像失败:', pullError.message);
        throw pullError;
      }
    }
  }

  /**
   * 为用户创建容器
   * @param {string} userId - 用户ID
   * @param {string} username - 用户名
   * @returns {Object} 容器信息
   */
  async createContainer(userId, username) {
    try {
      // 检查是否已有容器
      if (this.activeContainers.has(userId)) {
        const existing = this.activeContainers.get(userId);
        console.log(`♻️ 用户 ${username} 已有容器: ${existing.containerName}`);
        return existing;
      }

      const containerName = `webssh-${userId.substring(0, 8)}`;
      
      // 构建Docker运行命令
      const dockerCmd = this.buildDockerCommand(containerName, username);
      
      console.log(`🐳 为用户 ${username} 创建容器: ${containerName}`);
      
      // 启动容器
      const result = await this.execCommand(dockerCmd);
      const containerId = result.trim();
      
      // 等待容器启动
      await this.waitForContainer(containerId);
      
      // 初始化容器环境
      await this.initializeContainer(containerId, username);
      
      const containerInfo = {
        containerId: containerId,
        containerName: containerName,
        username: username,
        createdAt: Date.now(),
        lastActivity: Date.now()
      };
      
      this.activeContainers.set(userId, containerInfo);
      
      this.emit('container-created', {
        userId: userId,
        username: username,
        containerId: containerId,
        containerName: containerName
      });
      
      console.log(`✅ 容器创建成功: ${containerName} (${containerId.substring(0, 12)})`);
      
      return containerInfo;
      
    } catch (error) {
      console.error(`❌ 创建容器失败 (用户: ${username}):`, error.message);
      throw error;
    }
  }

  /**
   * 构建Docker运行命令
   * @param {string} containerName - 容器名称
   * @param {string} username - 用户名
   * @returns {string} Docker命令
   */
  buildDockerCommand(containerName, username) {
    const { limits, security, lifecycle } = this.containerConfig;
    
    const cmd = [
      'docker run -d',
      `--name ${containerName}`,
      
      // 资源限制
      `--memory=${limits.memory}`,
      `--cpus=${limits.cpus}`,
      `--pids-limit=${limits.pids}`,
      
      // 安全配置
      '--security-opt=no-new-privileges:true',
      '--cap-drop=ALL',
      '--cap-add=CHOWN',
      '--cap-add=DAC_OVERRIDE', 
      '--cap-add=FOWNER',
      '--cap-add=SETGID',
      '--cap-add=SETUID',
      
      // 网络配置
      '--network=bridge',
      '--dns=8.8.8.8',
      
      // 文件系统
      '--tmpfs /tmp:rw,noexec,nosuid,size=100m',
      '--read-only=false',
      
      // 环境变量
      `--env USER=${username}`,
      `--env HOME=/home/${username}`,
      '--env TERM=xterm-256color',
      '--env DEBIAN_FRONTEND=noninteractive',
      
      // 工作目录
      `--workdir /home/${username}`,
      
      // 自动清理
      lifecycle.autoRemove ? '--rm' : '',
      
      // 镜像和命令
      this.containerConfig.baseImage,
      'sleep infinity'
    ].filter(Boolean).join(' ');
    
    return cmd;
  }

  /**
   * 等待容器启动
   * @param {string} containerId - 容器ID
   */
  async waitForContainer(containerId) {
    const maxWait = 30; // 最大等待30秒
    let waited = 0;
    
    while (waited < maxWait) {
      try {
        const result = await this.execCommand(`docker inspect -f '{{.State.Running}}' ${containerId}`);
        if (result.trim() === 'true') {
          return;
        }
      } catch (error) {
        // 继续等待
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      waited++;
    }
    
    throw new Error('容器启动超时');
  }

  /**
   * 初始化容器环境
   * @param {string} containerId - 容器ID
   * @param {string} username - 用户名
   */
  async initializeContainer(containerId, username) {
    try {
      // 更新包列表并安装基础工具
      await this.execInContainer(containerId, 'apt-get update');
      await this.execInContainer(containerId, 'apt-get install -y curl wget git vim nano htop tree');
      
      // 创建用户
      await this.execInContainer(containerId, `useradd -m -s /bin/bash ${username}`);
      await this.execInContainer(containerId, `echo "${username}:webssh123" | chpasswd`);
      
      // 设置用户环境
      await this.execInContainer(containerId, `chown -R ${username}:${username} /home/${username}`);
      
      // 创建欢迎文件
      const welcomeMsg = `欢迎使用WebSSH容器环境！

您现在运行在一个独立的Docker容器中，拥有完整的Linux环境。

可用命令：
- 包管理: apt, apt-get, dpkg
- 开发工具: git, vim, nano, curl, wget
- 系统工具: htop, tree, ps, top
- 编程语言: 可以安装 python, node, java 等

注意事项：
- 容器会在1小时后自动清理
- 请及时保存重要文件
- 容器重启后数据会丢失

祝您使用愉快！`;
      
      await this.execInContainer(containerId, `echo '${welcomeMsg}' > /home/${username}/README.txt`);
      await this.execInContainer(containerId, `chown ${username}:${username} /home/${username}/README.txt`);
      
      console.log(`🔧 容器环境初始化完成: ${username}`);
      
    } catch (error) {
      console.error('容器初始化失败:', error.message);
      // 不抛出错误，允许容器继续使用
    }
  }

  /**
   * 在容器中执行命令
   * @param {string} containerId - 容器ID
   * @param {string} command - 命令
   * @returns {Promise<string>} 命令输出
   */
  async execInContainer(containerId, command) {
    const dockerCmd = `docker exec ${containerId} sh -c "${command}"`;
    return await this.execCommand(dockerCmd);
  }

  /**
   * 获取用户容器
   * @param {string} userId - 用户ID
   * @returns {Object|null} 容器信息
   */
  getUserContainer(userId) {
    return this.activeContainers.get(userId) || null;
  }

  /**
   * 删除用户容器
   * @param {string} userId - 用户ID
   */
  async removeContainer(userId) {
    const containerInfo = this.activeContainers.get(userId);
    if (!containerInfo) {
      return false;
    }

    try {
      // 停止并删除容器
      await this.execCommand(`docker stop ${containerInfo.containerId}`);
      await this.execCommand(`docker rm ${containerInfo.containerId}`);
      
      this.activeContainers.delete(userId);
      
      this.emit('container-removed', {
        userId: userId,
        containerId: containerInfo.containerId,
        containerName: containerInfo.containerName
      });
      
      console.log(`🗑️ 容器已删除: ${containerInfo.containerName}`);
      return true;
      
    } catch (error) {
      console.error('删除容器失败:', error.message);
      return false;
    }
  }

  /**
   * 更新容器活动时间
   * @param {string} userId - 用户ID
   */
  updateActivity(userId) {
    const containerInfo = this.activeContainers.get(userId);
    if (containerInfo) {
      containerInfo.lastActivity = Date.now();
    }
  }

  /**
   * 启动清理任务
   */
  startCleanupTasks() {
    // 每5分钟检查一次过期容器
    setInterval(() => {
      this.cleanupExpiredContainers();
    }, 5 * 60 * 1000);
  }

  /**
   * 清理过期容器
   */
  async cleanupExpiredContainers() {
    const now = Date.now();
    const timeout = this.containerConfig.lifecycle.timeout * 1000;
    
    for (const [userId, containerInfo] of this.activeContainers) {
      if (now - containerInfo.lastActivity > timeout) {
        console.log(`⏰ 清理过期容器: ${containerInfo.containerName}`);
        await this.removeContainer(userId);
      }
    }
  }

  /**
   * 执行系统命令
   * @param {string} command - 命令
   * @returns {Promise<string>} 命令输出
   */
  execCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  /**
   * 获取容器统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      activeContainers: this.activeContainers.size,
      containers: Array.from(this.activeContainers.values()).map(info => ({
        username: info.username,
        containerName: info.containerName,
        createdAt: info.createdAt,
        lastActivity: info.lastActivity
      }))
    };
  }
}

module.exports = ContainerManager;
