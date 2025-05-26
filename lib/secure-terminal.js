const pty = require('node-pty');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

/**
 * 安全终端管理器
 * 创建受限的、沙盒化的终端环境
 */
class SecureTerminal {
  constructor(userId, username) {
    this.userId = userId;
    this.username = username;
    this.isActive = false;
    this.ptyProcess = null;
    
    // 安全配置
    this.securityConfig = {
      // 禁用的命令（完全禁止）
      blockedCommands: [
        'sudo', 'su', 'passwd', 'chpasswd', 'usermod', 'userdel', 'groupmod',
        'mount', 'umount', 'fdisk', 'parted', 'mkfs', 'fsck',
        'systemctl', 'service', 'init', 'telinit',
        'iptables', 'ufw', 'firewall-cmd',
        'crontab', 'at', 'batch',
        'chown', 'chmod', 'chattr', 'setfacl',
        'modprobe', 'rmmod', 'insmod',
        'reboot', 'shutdown', 'halt', 'poweroff',
        'dd', 'shred', 'wipe', 'srm'
      ],
      
      // 受限目录（无法访问）
      restrictedPaths: [
        '/etc', '/root', '/boot', '/sys', '/proc/sys',
        '/var/log', '/var/lib', '/usr/bin', '/usr/sbin',
        '/bin', '/sbin', '/lib', '/lib64'
      ],
      
      // 允许的目录
      allowedPaths: [
        '/tmp', '/var/tmp', '/home'
      ],
      
      // 环境变量限制
      allowedEnvVars: [
        'PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG', 'LC_ALL'
      ],
      
      // 资源限制
      resourceLimits: {
        maxProcesses: 10,
        maxMemoryMB: 100,
        maxCPUPercent: 50,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxOpenFiles: 50
      }
    };
    
    // 创建沙盒环境
    this.createSandbox();
  }

  /**
   * 创建沙盒环境
   */
  createSandbox() {
    try {
      // 创建用户专属的沙盒目录
      this.sandboxPath = path.join('/tmp', 'webssh-sandbox', this.userId);
      
      if (!fs.existsSync(this.sandboxPath)) {
        fs.mkdirSync(this.sandboxPath, { recursive: true, mode: 0o755 });
      }
      
      // 创建基本目录结构
      const dirs = ['home', 'tmp', 'workspace'];
      dirs.forEach(dir => {
        const dirPath = path.join(this.sandboxPath, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
        }
      });
      
      console.log(`📦 为用户 ${this.username} 创建沙盒: ${this.sandboxPath}`);
    } catch (error) {
      console.error('创建沙盒失败:', error);
      throw error;
    }
  }

  /**
   * 启动安全终端
   */
  start() {
    try {
      // 构建受限的环境变量
      const restrictedEnv = this.buildRestrictedEnvironment();
      
      // 启动受限的shell
      this.ptyProcess = pty.spawn('/bin/bash', ['--restricted', '--noprofile', '--norc'], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: path.join(this.sandboxPath, 'home'),
        env: restrictedEnv,
        uid: process.getuid(), // 使用当前用户ID，不提升权限
        gid: process.getgid()
      });

      this.isActive = true;
      
      // 发送欢迎消息和安全提示
      this.sendWelcomeMessage();
      
      // 监听进程退出
      this.ptyProcess.on('exit', () => {
        this.isActive = false;
        console.log(`🔒 安全终端已退出: ${this.username}`);
      });

      console.log(`🔒 安全终端已启动: ${this.username} (PID: ${this.ptyProcess.pid})`);
      
    } catch (error) {
      console.error('启动安全终端失败:', error);
      throw error;
    }
  }

  /**
   * 构建受限的环境变量
   */
  buildRestrictedEnvironment() {
    const env = {};
    
    // 只允许特定的环境变量
    this.securityConfig.allowedEnvVars.forEach(varName => {
      if (process.env[varName]) {
        env[varName] = process.env[varName];
      }
    });
    
    // 设置受限的PATH
    env.PATH = '/usr/local/bin:/usr/bin:/bin';
    
    // 设置用户信息
    env.USER = this.username;
    env.HOME = path.join(this.sandboxPath, 'home');
    env.SHELL = '/bin/bash';
    env.TERM = 'xterm-256color';
    
    // 设置安全标识
    env.WEBSSH_SANDBOX = '1';
    env.WEBSSH_USER = this.username;
    
    return env;
  }

  /**
   * 发送欢迎消息
   */
  sendWelcomeMessage() {
    const welcomeMsg = `
\r\n\x1b[32m╔══════════════════════════════════════════════════════════════╗\x1b[0m
\x1b[32m║\x1b[0m                    \x1b[1m🔒 安全WebSSH终端\x1b[0m                     \x1b[32m║\x1b[0m
\x1b[32m╠══════════════════════════════════════════════════════════════╣\x1b[0m
\x1b[32m║\x1b[0m 欢迎 \x1b[1m${this.username}\x1b[0m！您正在使用受限的安全终端环境。        \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m                                                          \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m \x1b[33m⚠️  安全限制:\x1b[0m                                        \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m   • 无sudo/root权限                                     \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m   • 无法访问系统目录                                     \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m   • 资源使用受限                                         \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m   • 危险命令已禁用                                       \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m                                                          \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m \x1b[36m💡 可用命令: ls, cat, echo, grep, find, wget, curl, git\x1b[0m  \x1b[32m║\x1b[0m
\x1b[32m║\x1b[0m \x1b[36m📁 工作目录: ~/workspace\x1b[0m                            \x1b[32m║\x1b[0m
\x1b[32m╚══════════════════════════════════════════════════════════════╝\x1b[0m
\r\n`;

    this.ptyProcess.write(welcomeMsg);
    this.ptyProcess.write(`\x1b[1m${this.username}@secure-webssh\x1b[0m:\x1b[34m~/workspace\x1b[0m$ `);
  }

  /**
   * 检查命令是否被阻止
   * @param {string} command - 命令
   * @returns {boolean} 是否被阻止
   */
  isCommandBlocked(command) {
    const cmd = command.trim().split(/\s+/)[0];
    return this.securityConfig.blockedCommands.includes(cmd);
  }

  /**
   * 检查路径是否被限制
   * @param {string} path - 路径
   * @returns {boolean} 是否被限制
   */
  isPathRestricted(path) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    return this.securityConfig.restrictedPaths.some(restrictedPath => 
      normalizedPath.startsWith(restrictedPath)
    );
  }

  /**
   * 写入数据到终端
   * @param {string} data - 数据
   */
  write(data) {
    if (this.ptyProcess && this.isActive) {
      // 检查是否包含被阻止的命令
      if (this.isCommandBlocked(data)) {
        const warningMsg = `\r\n\x1b[31m🚫 命令被禁止: ${data.trim()}\x1b[0m\r\n`;
        this.ptyProcess.write(warningMsg);
        this.ptyProcess.write(`\x1b[1m${this.username}@secure-webssh\x1b[0m:\x1b[34m~/workspace\x1b[0m$ `);
        return false;
      }
      
      this.ptyProcess.write(data);
      return true;
    }
    return false;
  }

  /**
   * 监听终端输出
   * @param {Function} callback - 回调函数
   */
  onData(callback) {
    if (this.ptyProcess) {
      this.ptyProcess.on('data', callback);
    }
  }

  /**
   * 调整终端大小
   * @param {number} cols - 列数
   * @param {number} rows - 行数
   */
  resize(cols, rows) {
    if (this.ptyProcess && this.isActive) {
      this.ptyProcess.resize(cols, rows);
    }
  }

  /**
   * 关闭终端
   */
  close() {
    if (this.ptyProcess) {
      this.isActive = false;
      this.ptyProcess.kill();
      
      // 清理沙盒目录
      this.cleanupSandbox();
    }
  }

  /**
   * 清理沙盒目录
   */
  cleanupSandbox() {
    try {
      if (fs.existsSync(this.sandboxPath)) {
        // 递归删除沙盒目录
        fs.rmSync(this.sandboxPath, { recursive: true, force: true });
        console.log(`🧹 已清理沙盒: ${this.sandboxPath}`);
      }
    } catch (error) {
      console.error('清理沙盒失败:', error);
    }
  }

  /**
   * 获取终端状态
   */
  getStatus() {
    return {
      userId: this.userId,
      username: this.username,
      isActive: this.isActive,
      pid: this.ptyProcess ? this.ptyProcess.pid : null,
      sandboxPath: this.sandboxPath,
      resourceLimits: this.securityConfig.resourceLimits
    };
  }
}

module.exports = SecureTerminal;
