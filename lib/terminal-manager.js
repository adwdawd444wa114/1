const pty = require('node-pty');
const EventEmitter = require('events');
const CommandFilter = require('./command-filter');

class TerminalManager extends EventEmitter {
  constructor() {
    super();
    this.terminals = new Map(); // terminalId -> terminal info
    this.commandFilter = new CommandFilter();
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
      env: process.env
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
      
      // 过滤危险命令
      if (this.commandFilter.isDangerous(command)) {
        const warningMsg = `\r\n\x1b[31m警告: 命令 "${command}" 被禁止执行\x1b[0m\r\n`;
        terminal.ptyProcess.write(warningMsg);
        terminal.ptyProcess.write(`${terminal.ownerName}@webssh:$ `);
        return false;
      }
    }

    // 写入终端
    terminal.ptyProcess.write(data);
    return true;
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
      console.log(`终端 ${terminalId} 已关闭`);
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
