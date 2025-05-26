const { v4: uuidv4 } = require('uuid');

class SessionManager {
  constructor() {
    this.sessions = new Map(); // socketId -> session
    this.usernames = new Set(); // 已使用的用户名
    this.userSessions = new Map(); // userId -> session
  }

  /**
   * 创建新会话
   * @param {string} socketId - Socket ID
   * @param {string} username - 用户名
   * @returns {Object} 会话信息
   */
  createSession(socketId, username) {
    // 检查用户名是否已存在
    if (this.usernames.has(username)) {
      throw new Error('用户名已存在');
    }

    const userId = uuidv4();
    const session = {
      userId: userId,
      socketId: socketId,
      username: username,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true
    };

    this.sessions.set(socketId, session);
    this.usernames.add(username);
    this.userSessions.set(userId, session);

    console.log(`创建会话: ${username} (${userId})`);
    return session;
  }

  /**
   * 根据Socket ID获取会话
   * @param {string} socketId - Socket ID
   * @returns {Object|null} 会话信息
   */
  getSessionBySocketId(socketId) {
    return this.sessions.get(socketId) || null;
  }

  /**
   * 根据用户ID获取会话
   * @param {string} userId - 用户ID
   * @returns {Object|null} 会话信息
   */
  getSessionByUserId(userId) {
    return this.userSessions.get(userId) || null;
  }

  /**
   * 根据用户名获取会话
   * @param {string} username - 用户名
   * @returns {Object|null} 会话信息
   */
  getSessionByUsername(username) {
    for (const session of this.sessions.values()) {
      if (session.username === username) {
        return session;
      }
    }
    return null;
  }

  /**
   * 检查用户名是否已存在
   * @param {string} username - 用户名
   * @returns {boolean} 是否存在
   */
  isUserExists(username) {
    return this.usernames.has(username);
  }

  /**
   * 更新会话活动时间
   * @param {string} socketId - Socket ID
   */
  updateActivity(socketId) {
    const session = this.sessions.get(socketId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * 删除会话
   * @param {string} socketId - Socket ID
   */
  removeSession(socketId) {
    const session = this.sessions.get(socketId);
    if (session) {
      this.sessions.delete(socketId);
      this.usernames.delete(session.username);
      this.userSessions.delete(session.userId);
      console.log(`删除会话: ${session.username} (${session.userId})`);
    }
  }

  /**
   * 获取所有活跃用户
   * @returns {Array} 用户列表
   */
  getAllUsers() {
    return Array.from(this.sessions.values()).map(session => ({
      userId: session.userId,
      username: session.username,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      isActive: session.isActive
    }));
  }

  /**
   * 获取在线用户数量
   * @returns {number} 在线用户数量
   */
  getOnlineUserCount() {
    return this.sessions.size;
  }

  /**
   * 检查用户是否有权限访问终端
   * @param {string} socketId - Socket ID
   * @param {string} terminalId - 终端ID
   * @returns {Object} 权限检查结果
   */
  checkTerminalPermission(socketId, terminalId) {
    const session = this.sessions.get(socketId);
    if (!session) {
      return {
        hasPermission: false,
        canRead: false,
        canWrite: false,
        reason: '未找到用户会话'
      };
    }

    // 提取终端所有者ID
    const terminalOwnerId = terminalId.replace('terminal_', '');
    
    // 检查是否是自己的终端
    const isOwner = session.userId === terminalOwnerId;
    
    return {
      hasPermission: true,
      canRead: true,  // 所有用户都可以读取
      canWrite: isOwner,  // 只有所有者可以写入
      isOwner: isOwner,
      reason: isOwner ? '终端所有者' : '只读访问'
    };
  }

  /**
   * 获取会话统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const now = new Date();
    const sessions = Array.from(this.sessions.values());
    
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.isActive).length,
      averageSessionDuration: sessions.reduce((acc, session) => {
        return acc + (now - session.createdAt);
      }, 0) / sessions.length || 0,
      oldestSession: sessions.reduce((oldest, session) => {
        return !oldest || session.createdAt < oldest.createdAt ? session : oldest;
      }, null),
      newestSession: sessions.reduce((newest, session) => {
        return !newest || session.createdAt > newest.createdAt ? session : newest;
      }, null)
    };
  }

  /**
   * 清理过期会话
   * @param {number} timeoutMinutes - 超时时间（分钟）
   */
  cleanupExpiredSessions(timeoutMinutes = 30) {
    const now = new Date();
    const timeoutMs = timeoutMinutes * 60 * 1000;
    
    for (const [socketId, session] of this.sessions) {
      if (now - session.lastActivity > timeoutMs) {
        console.log(`清理过期会话: ${session.username} (${session.userId})`);
        this.removeSession(socketId);
      }
    }
  }

  /**
   * 清理所有会话
   */
  cleanup() {
    this.sessions.clear();
    this.usernames.clear();
    this.userSessions.clear();
    console.log('所有会话已清理');
  }
}

module.exports = SessionManager;
