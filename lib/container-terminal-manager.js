const EventEmitter = require('events');
const CommandFilter = require('./command-filter');
const ContainerManager = require('./container-manager');
const ContainerTerminal = require('./container-terminal');

/**
 * 容器终端管理器
 * 管理基于Docker容器的终端会话
 */
class ContainerTerminalManager extends EventEmitter {
  constructor() {
    super();
    this.terminals = new Map(); // terminalId -> terminal info
    this.commandFilter = new CommandFilter();
    this.containerManager = new ContainerManager();
    
    console.log('🐳 容器终端管理器已启动');
  }

  /**
   * 创建新的容器终端
   * @param {string} ownerId - 终端所有者ID
   * @param {string} ownerName - 终端所有者名称
   * @returns {Object} 终端信息
   */
  async createTerminal(ownerId, ownerName) {
    const terminalId = `terminal_${ownerId}`;

    // 如果终端已存在，先关闭
    if (this.terminals.has(terminalId)) {
      await this.closeTerminal(ownerId);
    }

    try {
      // 创建或获取用户容器
      const containerInfo = await this.containerManager.createContainer(ownerId, ownerName);
      
      // 创建容器终端
      const containerTerminal = new ContainerTerminal(containerInfo.containerId, ownerName);
      
      const terminalInfo = {
        id: terminalId,
        ownerId: ownerId,
        ownerName: ownerName,
        ptyProcess: containerTerminal, // 兼容原有接口
        containerTerminal: containerTerminal,
        containerInfo: containerInfo,
        createdAt: new Date(),
        isActive: true,
        isContainer: true
      };

      // 启动容器终端
      containerTerminal.start();

      // 监听终端输出
      containerTerminal.on('data', (data) => {
        this.containerManager.updateActivity(ownerId);
        this.emit('terminal-output', terminalId, data);
      });

      // 监听终端退出
      containerTerminal.on('exit', () => {
        console.log(`容器终端 ${terminalId} 退出`);
        this.terminals.delete(terminalId);
        this.emit('terminal-closed', terminalId);
      });

      containerTerminal.on('error', (error) => {
        console.error(`容器终端错误 ${terminalId}:`, error);
        this.terminals.delete(terminalId);
        this.emit('terminal-closed', terminalId);
      });

      this.terminals.set(terminalId, terminalInfo);

      console.log(`为用户 ${ownerName} 创建容器终端: ${terminalId}`);
      return terminalInfo;

    } catch (error) {
      console.error('创建容器终端失败:', error);
      throw error;
    }
  }

  /**
   * 向终端写入数据
   * @param {string} terminalId - 终端ID
   * @param {string} data - 数据
   * @returns {boolean} 是否成功
   */
  writeToTerminal(terminalId, data) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || !terminal.isActive) {
      return false;
    }

    try {
      // 在容器模式下，我们不需要命令过滤，因为容器本身就是隔离的
      // 但仍然可以记录一些统计信息
      if (data.trim()) {
        this.containerManager.updateActivity(terminal.ownerId);
      }

      return terminal.containerTerminal.write(data);
    } catch (error) {
      console.error('写入终端失败:', error);
      return false;
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
      terminal.containerTerminal.resize(cols, rows);
    }
  }

  /**
   * 关闭终端
   * @param {string} ownerId - 终端所有者ID
   */
  async closeTerminal(ownerId) {
    const terminalId = `terminal_${ownerId}`;
    const terminal = this.terminals.get(terminalId);

    if (terminal) {
      terminal.isActive = false;
      
      // 关闭容器终端
      if (terminal.containerTerminal) {
        terminal.containerTerminal.close();
      }
      
      this.terminals.delete(terminalId);
      
      console.log(`容器终端 ${terminalId} 已关闭`);
      this.emit('terminal-closed', terminalId);
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
   * 获取所有终端
   * @returns {Array} 终端列表
   */
  getAllTerminals() {
    return Array.from(this.terminals.values()).map(terminal => ({
      id: terminal.id,
      ownerId: terminal.ownerId,
      ownerName: terminal.ownerName,
      isActive: terminal.isActive,
      createdAt: terminal.createdAt,
      isContainer: terminal.isContainer,
      containerInfo: terminal.containerInfo ? {
        containerId: terminal.containerInfo.containerId.substring(0, 12),
        containerName: terminal.containerInfo.containerName
      } : null
    }));
  }

  /**
   * 获取用户的终端
   * @param {string} ownerId - 用户ID
   * @returns {Object|null} 终端信息
   */
  getUserTerminal(ownerId) {
    const terminalId = `terminal_${ownerId}`;
    return this.getTerminal(terminalId);
  }

  /**
   * 检查终端是否存在且活跃
   * @param {string} terminalId - 终端ID
   * @returns {boolean} 是否存在且活跃
   */
  isTerminalActive(terminalId) {
    const terminal = this.terminals.get(terminalId);
    return terminal && terminal.isActive;
  }

  /**
   * 获取容器统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const containerStats = this.containerManager.getStats();
    
    return {
      activeTerminals: this.terminals.size,
      activeContainers: containerStats.activeContainers,
      terminals: this.getAllTerminals(),
      containers: containerStats.containers
    };
  }

  /**
   * 清理所有终端和容器
   */
  async cleanup() {
    console.log('🧹 开始清理所有容器终端...');
    
    const cleanupPromises = [];
    
    for (const [terminalId, terminal] of this.terminals) {
      cleanupPromises.push(this.closeTerminal(terminal.ownerId));
    }
    
    await Promise.all(cleanupPromises);
    
    console.log('✅ 容器终端清理完成');
  }

  /**
   * 执行容器中的命令（非交互式）
   * @param {string} ownerId - 用户ID
   * @param {string} command - 命令
   * @returns {Promise<string>} 命令输出
   */
  async execCommand(ownerId, command) {
    const terminal = this.getUserTerminal(ownerId);
    if (!terminal || !terminal.isActive) {
      throw new Error('终端不存在或未激活');
    }

    return await terminal.containerTerminal.execCommand(command);
  }

  /**
   * 获取容器信息
   * @param {string} ownerId - 用户ID
   * @returns {Object|null} 容器信息
   */
  getContainerInfo(ownerId) {
    const terminal = this.getUserTerminal(ownerId);
    return terminal ? terminal.containerInfo : null;
  }
}

module.exports = ContainerTerminalManager;
