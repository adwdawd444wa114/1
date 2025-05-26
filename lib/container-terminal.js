const { spawn } = require('child_process');
const EventEmitter = require('events');

/**
 * 容器终端管理器
 * 在Docker容器中创建和管理终端会话
 */
class ContainerTerminal extends EventEmitter {
  constructor(containerId, username) {
    super();
    
    this.containerId = containerId;
    this.username = username;
    this.isActive = false;
    this.dockerProcess = null;
    this.lastActivity = Date.now();
    
    // 终端配置
    this.terminalConfig = {
      shell: '/bin/bash',
      cols: 80,
      rows: 24,
      env: {
        TERM: 'xterm-256color',
        USER: username,
        HOME: `/home/${username}`,
        SHELL: '/bin/bash',
        PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      }
    };
  }

  /**
   * 启动容器终端
   */
  start() {
    try {
      // 使用docker exec创建交互式终端
      const dockerArgs = [
        'exec',
        '-it',
        '--user', this.username,
        '--workdir', `/home/${this.username}`,
        this.containerId,
        this.terminalConfig.shell
      ];

      console.log(`🐳 启动容器终端: ${this.containerId.substring(0, 12)} (用户: ${this.username})`);

      this.dockerProcess = spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...this.terminalConfig.env
        }
      });

      this.isActive = true;
      this.lastActivity = Date.now();

      // 监听进程输出
      this.dockerProcess.stdout.on('data', (data) => {
        this.lastActivity = Date.now();
        this.emit('data', data);
      });

      this.dockerProcess.stderr.on('data', (data) => {
        this.lastActivity = Date.now();
        this.emit('data', data);
      });

      // 监听进程退出
      this.dockerProcess.on('exit', (code, signal) => {
        this.isActive = false;
        console.log(`🔚 容器终端退出: ${this.containerId.substring(0, 12)} (代码: ${code}, 信号: ${signal})`);
        this.emit('exit', { code, signal });
      });

      this.dockerProcess.on('error', (error) => {
        this.isActive = false;
        console.error(`❌ 容器终端错误: ${error.message}`);
        this.emit('error', error);
      });

      // 发送欢迎消息
      setTimeout(() => {
        this.sendWelcomeMessage();
      }, 1000);

      console.log(`✅ 容器终端已启动: ${this.username}`);

    } catch (error) {
      console.error('启动容器终端失败:', error);
      throw error;
    }
  }

  /**
   * 发送欢迎消息
   */
  sendWelcomeMessage() {
    const welcomeMsg = `
\r\n\x1b[32m╔══════════════════════════════════════════════════════════════╗\x1b[0m
\x1b[32m║\x1b[0m                    \x1b[1m🐳 WebSSH 容器终端\x1b[0m                    \x1b[32m║\x1b[0m
\x1b[32m╠══════════════════════════════════════════════════════════════╣\x1b[0m
\x1b[32m║\x1b[0m 欢迎 \x1b[1m${this.username}\x1b[0m！您现在运行在独立的Docker容器中。      \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m                                                          \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m \x1b[33m🎉 容器特性:\x1b[0m                                        \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m   • 完整的Ubuntu 22.04环境                              \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m   • 可以安装任何软件包 (apt install)                    \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m   • 完全隔离，不影响宿主机                              \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m   • 512MB内存 + 0.5CPU核心                             \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m                                                          \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m \x1b[36m💡 快速开始:\x1b[0m                                        \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m   • cat README.txt - 查看详细说明                       \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m   • apt update && apt install python3 - 安装Python      \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m   • apt install nodejs npm - 安装Node.js               \x1b[32m║\x1b[0m
\x1b[32m╚══════════════════════════════════════════════════════════════╝\x1b[0m
\r\n`;

    this.write(welcomeMsg);
  }

  /**
   * 写入数据到终端
   * @param {string|Buffer} data - 数据
   */
  write(data) {
    if (this.dockerProcess && this.isActive) {
      this.lastActivity = Date.now();
      this.dockerProcess.stdin.write(data);
      return true;
    }
    return false;
  }

  /**
   * 调整终端大小
   * @param {number} cols - 列数
   * @param {number} rows - 行数
   */
  resize(cols, rows) {
    // Docker exec不直接支持resize，但可以通过环境变量传递
    this.terminalConfig.cols = cols;
    this.terminalConfig.rows = rows;
    
    // 发送resize信号到容器
    if (this.dockerProcess && this.isActive) {
      try {
        // 尝试发送SIGWINCH信号
        this.dockerProcess.kill('SIGWINCH');
      } catch (error) {
        // 忽略错误，某些情况下可能不支持
      }
    }
  }

  /**
   * 关闭终端
   */
  close() {
    if (this.dockerProcess) {
      this.isActive = false;
      
      try {
        // 优雅关闭
        this.dockerProcess.stdin.end();
        this.dockerProcess.kill('SIGTERM');
        
        // 如果5秒后还没关闭，强制杀死
        setTimeout(() => {
          if (this.dockerProcess && !this.dockerProcess.killed) {
            this.dockerProcess.kill('SIGKILL');
          }
        }, 5000);
        
      } catch (error) {
        console.error('关闭容器终端失败:', error);
      }
    }
  }

  /**
   * 获取终端状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      containerId: this.containerId,
      username: this.username,
      isActive: this.isActive,
      pid: this.dockerProcess ? this.dockerProcess.pid : null,
      lastActivity: this.lastActivity,
      cols: this.terminalConfig.cols,
      rows: this.terminalConfig.rows
    };
  }

  /**
   * 检查终端是否活跃
   * @returns {boolean} 是否活跃
   */
  isAlive() {
    return this.isActive && this.dockerProcess && !this.dockerProcess.killed;
  }

  /**
   * 获取最后活动时间
   * @returns {number} 时间戳
   */
  getLastActivity() {
    return this.lastActivity;
  }

  /**
   * 执行单个命令（非交互式）
   * @param {string} command - 命令
   * @returns {Promise<string>} 命令输出
   */
  async execCommand(command) {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      
      const dockerArgs = [
        'exec',
        '--user', this.username,
        '--workdir', `/home/${this.username}`,
        this.containerId,
        'sh', '-c', command
      ];

      const process = spawn('docker', dockerArgs);
      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(error || `命令执行失败，退出代码: ${code}`));
        }
      });

      process.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * 检查容器是否仍在运行
   * @returns {Promise<boolean>} 容器是否运行
   */
  async isContainerRunning() {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec(`docker inspect -f '{{.State.Running}}' ${this.containerId}`, (error, stdout) => {
          if (error) {
            resolve(false);
          } else {
            resolve(stdout.trim() === 'true');
          }
        });
      });
    } catch (error) {
      return false;
    }
  }
}

module.exports = ContainerTerminal;
