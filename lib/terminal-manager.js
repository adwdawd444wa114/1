const pty = require('node-pty');
const EventEmitter = require('events');
const CommandFilter = require('./command-filter');
const ContainerManager = require('./container-manager');
const ContainerTerminal = require('./container-terminal');

class TerminalManager extends EventEmitter {
  constructor() {
    super();
    this.terminals = new Map(); // terminalId -> terminal info
    this.commandFilter = new CommandFilter();
    this.containerManager = new ContainerManager(); // 容器管理器
    this.useContainers = process.env.USE_CONTAINERS !== 'false'; // 默认使用容器

    console.log(`🔧 终端管理器模式: ${this.useContainers ? '容器模式' : '本地模式'}`);
  }

  /**
   * 创建新终端
   * @param {string} ownerId - 终端所有者ID
   * @param {string} ownerName - 终端所有者名称
   * @returns {Object} 终端信息
   */
  createTerminal(ownerId, ownerName) {
    const terminalId = `terminal_${ownerId}`;

    // 如果终端已存在，先关闭
    if (this.terminals.has(terminalId)) {
      this.closeTerminal(ownerId);
    }

    // 创建伪终端进程
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || process.cwd(),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        PS1: `${ownerName}@linuxdo:$ ` // 设置自定义提示符
      },
      // 禁用回显以避免重复输入
      handleFlowControl: false,
      experimentalUseConpty: false
    });

    const terminalInfo = {
      id: terminalId,
      ownerId: ownerId,
      ownerName: ownerName,
      ptyProcess: ptyProcess,
      createdAt: new Date(),
      isActive: true
    };

    // 监听终端输出
    ptyProcess.onData((data) => {
      this.emit('terminal-output', terminalId, data);
    });

    // 监听终端退出
    ptyProcess.onExit((exitCode) => {
      console.log(`终端 ${terminalId} 退出，退出码: ${exitCode}`);
      this.terminals.delete(terminalId);
      this.emit('terminal-closed', terminalId);
    });

    this.terminals.set(terminalId, terminalInfo);

    console.log(`为用户 ${ownerName} 创建终端: ${terminalId}`);
    return terminalInfo;
  }

  /**
   * 向终端写入数据
   * @param {string} terminalId - 终端ID
   * @param {string} data - 要写入的数据
   */
  writeToTerminal(terminalId, data) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || !terminal.isActive) {
      console.log(`终端 ${terminalId} 不存在或已关闭`);
      return false;
    }

    // 检查是否是命令输入（以回车结尾）
    if (data.includes('\r') || data.includes('\n')) {
      const command = data.replace(/[\r\n]/g, '').trim();

      // 跳过空命令
      if (!command) {
        terminal.ptyProcess.write(data);
        return true;
      }

      // 过滤危险命令（使用增强的检测）
      const dangerResult = this.commandFilter.isDangerous(command, terminal.ownerId);
      if (dangerResult.isDangerous) {
        const timestamp = new Date().toISOString();

        // 记录危险命令尝试
        console.log(`[${timestamp}] 🚨 安全违规 [${dangerResult.severity.toUpperCase()}]: 用户 ${terminal.ownerName} (${terminal.ownerId}) 尝试执行危险命令: "${command}"`);

        // 根据严重程度选择不同的警告样式
        let warningColor = '\x1b[31m'; // 红色
        let warningIcon = '🚫';

        switch (dangerResult.severity) {
          case 'critical':
            warningColor = '\x1b[91m'; // 亮红色
            warningIcon = '🔥';
            break;
          case 'high':
            warningColor = '\x1b[31m'; // 红色
            warningIcon = '⚠️';
            break;
          case 'medium':
            warningColor = '\x1b[33m'; // 黄色
            warningIcon = '⚡';
            break;
          default:
            warningColor = '\x1b[31m';
            warningIcon = '🚫';
        }

        // 发送警告消息到终端
        const warningMsg = `\r\n${warningColor}${warningIcon} 安全警告 [${dangerResult.severity.toUpperCase()}]: 命令 "${command}" 被禁止执行\x1b[0m\r\n`;
        const reasonMsg = dangerResult.reason ? `\x1b[33m原因: ${dangerResult.reason}\x1b[0m\r\n` : '';
        const helpMsg = `\x1b[36m💡 提示: 这是为了保护系统安全，请使用安全的命令\x1b[0m\r\n`;

        // 如果是速率限制，显示额外信息
        const rateLimitStatus = this.commandFilter.getUserRateLimitStatus(terminal.ownerId);
        let rateLimitMsg = '';
        if (rateLimitStatus.blocked) {
          const blockedUntil = new Date(rateLimitStatus.blockedUntil);
          rateLimitMsg = `\x1b[35m⏰ 您已被临时限制，解除时间: ${blockedUntil.toLocaleTimeString()}\x1b[0m\r\n`;
        } else if (rateLimitStatus.dangerousAttempts > 0) {
          const remaining = 3 - rateLimitStatus.dangerousAttempts;
          rateLimitMsg = `\x1b[35m⚠️ 危险命令尝试: ${rateLimitStatus.dangerousAttempts}/3，剩余机会: ${remaining}\x1b[0m\r\n`;
        }

        terminal.ptyProcess.write(warningMsg + reasonMsg + rateLimitMsg + helpMsg);
        terminal.ptyProcess.write(`${terminal.ownerName}@linuxdo:$ `);

        // 触发安全事件
        this.emit('security-violation', {
          terminalId: terminalId,
          ownerId: terminal.ownerId,
          ownerName: terminal.ownerName,
          command: command,
          reason: dangerResult.reason,
          severity: dangerResult.severity,
          timestamp: timestamp,
          rateLimitStatus: rateLimitStatus
        });

        return false;
      }

      // 记录正常命令（可选，用于审计）
      if (command.length > 0) {
        console.log(`[${new Date().toISOString()}] 用户 ${terminal.ownerName} 执行命令: "${command}"`);
      }
    }

    // 写入终端
    try {
      terminal.ptyProcess.write(data);
      return true;
    } catch (error) {
      console.error(`写入终端 ${terminalId} 失败:`, error);
      return false;
    }
  }

  /**
   * 获取终端信息
   * @param {string} terminalId - 终端ID
   * @returns {Object|null} 终端信息
   */
  getTerminal(terminalId) {
    return this.terminals.get(terminalId) || null;
  }

  /**
   * 获取所有终端信息
   * @returns {Array} 终端信息列表
   */
  getAllTerminals() {
    return Array.from(this.terminals.values()).map(terminal => ({
      id: terminal.id,
      ownerId: terminal.ownerId,
      ownerName: terminal.ownerName,
      createdAt: terminal.createdAt,
      isActive: terminal.isActive
    }));
  }

  /**
   * 关闭终端
   * @param {string} ownerId - 终端所有者ID
   */
  closeTerminal(ownerId) {
    const terminalId = `terminal_${ownerId}`;
    const terminal = this.terminals.get(terminalId);

    if (terminal) {
      terminal.isActive = false;
      terminal.ptyProcess.kill();
      this.terminals.delete(terminalId);

      // 清理用户的速率限制记录
      this.commandFilter.clearUserRateLimit(ownerId);

      console.log(`终端 ${terminalId} 已关闭，已清理用户速率限制记录`);
      this.emit('terminal-closed', terminalId);
    }
  }

  /**
   * 调整终端大小
   * @param {string} terminalId - 终端ID
   * @param {number} cols - 列数
   * @param {number} rows - 行数
   */
  resizeTerminal(terminalId, cols, rows) {
    const terminal = this.terminals.get(terminalId);
    if (terminal && terminal.isActive) {
      terminal.ptyProcess.resize(cols, rows);
    }
  }

  /**
   * 清理所有终端
   */
  cleanup() {
    for (const [terminalId, terminal] of this.terminals) {
      terminal.ptyProcess.kill();
    }
    this.terminals.clear();
  }
}

module.exports = TerminalManager;
