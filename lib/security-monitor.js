const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

/**
 * 安全监控模块
 * 提供实时安全监控、日志记录和威胁检测
 */
class SecurityMonitor extends EventEmitter {
  constructor() {
    super();
    
    // 安全事件日志
    this.securityLog = [];
    this.maxLogSize = 1000;
    
    // 威胁检测配置
    this.threatConfig = {
      maxViolationsPerUser: 5,
      maxViolationsPerMinute: 10,
      autoBlockThreshold: 3,
      logFilePath: path.join(process.cwd(), 'logs', 'security.log')
    };
    
    // 用户威胁评分
    this.userThreatScores = new Map();
    
    // 被封禁的用户
    this.blockedUsers = new Set();
    
    // 确保日志目录存在
    this.ensureLogDirectory();
    
    // 启动定期清理任务
    this.startCleanupTasks();
  }

  /**
   * 确保日志目录存在
   */
  ensureLogDirectory() {
    const logDir = path.dirname(this.threatConfig.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * 记录安全事件
   * @param {Object} event - 安全事件
   */
  logSecurityEvent(event) {
    const logEntry = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      userAgent: event.userAgent || 'unknown',
      ipAddress: event.ipAddress || 'unknown'
    };

    // 添加到内存日志
    this.securityLog.push(logEntry);
    
    // 保持日志大小限制
    if (this.securityLog.length > this.maxLogSize) {
      this.securityLog.shift();
    }

    // 写入文件日志
    this.writeToLogFile(logEntry);

    // 更新用户威胁评分
    this.updateThreatScore(event.ownerId, event.severity);

    // 检查是否需要自动封禁
    this.checkAutoBlock(event.ownerId);

    // 触发安全事件
    this.emit('security-event', logEntry);

    console.log(`🔒 安全事件记录: ${event.ownerName} - ${event.reason} [${event.severity}]`);
  }

  /**
   * 写入日志文件
   * @param {Object} logEntry - 日志条目
   */
  writeToLogFile(logEntry) {
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.threatConfig.logFilePath, logLine);
    } catch (error) {
      console.error('写入安全日志失败:', error);
    }
  }

  /**
   * 更新用户威胁评分
   * @param {string} userId - 用户ID
   * @param {string} severity - 严重程度
   */
  updateThreatScore(userId, severity) {
    if (!this.userThreatScores.has(userId)) {
      this.userThreatScores.set(userId, {
        score: 0,
        violations: [],
        lastViolation: null
      });
    }

    const userThreat = this.userThreatScores.get(userId);
    const now = Date.now();

    // 根据严重程度计算分数
    let scoreIncrease = 0;
    switch (severity) {
      case 'critical': scoreIncrease = 10; break;
      case 'high': scoreIncrease = 5; break;
      case 'medium': scoreIncrease = 2; break;
      case 'low': scoreIncrease = 1; break;
      default: scoreIncrease = 1;
    }

    userThreat.score += scoreIncrease;
    userThreat.violations.push({ timestamp: now, severity, score: scoreIncrease });
    userThreat.lastViolation = now;

    // 清理过期的违规记录（24小时前）
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    userThreat.violations = userThreat.violations.filter(v => v.timestamp > oneDayAgo);
    
    // 重新计算分数
    userThreat.score = userThreat.violations.reduce((sum, v) => sum + v.score, 0);
  }

  /**
   * 检查是否需要自动封禁
   * @param {string} userId - 用户ID
   */
  checkAutoBlock(userId) {
    const userThreat = this.userThreatScores.get(userId);
    if (!userThreat) return;

    // 检查最近5分钟的违规次数
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentViolations = userThreat.violations.filter(v => v.timestamp > fiveMinutesAgo);

    if (recentViolations.length >= this.threatConfig.autoBlockThreshold) {
      this.blockUser(userId, '自动封禁：短时间内多次安全违规');
    }
  }

  /**
   * 封禁用户
   * @param {string} userId - 用户ID
   * @param {string} reason - 封禁原因
   */
  blockUser(userId, reason) {
    this.blockedUsers.add(userId);
    
    const blockEvent = {
      type: 'user-blocked',
      userId: userId,
      reason: reason,
      timestamp: new Date().toISOString()
    };

    this.logSecurityEvent(blockEvent);
    this.emit('user-blocked', blockEvent);

    console.log(`🚫 用户已被封禁: ${userId} - ${reason}`);
  }

  /**
   * 解封用户
   * @param {string} userId - 用户ID
   */
  unblockUser(userId) {
    this.blockedUsers.delete(userId);
    this.userThreatScores.delete(userId);

    const unblockEvent = {
      type: 'user-unblocked',
      userId: userId,
      timestamp: new Date().toISOString()
    };

    this.emit('user-unblocked', unblockEvent);
    console.log(`✅ 用户已解封: ${userId}`);
  }

  /**
   * 检查用户是否被封禁
   * @param {string} userId - 用户ID
   * @returns {boolean} 是否被封禁
   */
  isUserBlocked(userId) {
    return this.blockedUsers.has(userId);
  }

  /**
   * 获取用户威胁评分
   * @param {string} userId - 用户ID
   * @returns {Object} 威胁评分信息
   */
  getUserThreatScore(userId) {
    const userThreat = this.userThreatScores.get(userId);
    if (!userThreat) {
      return { score: 0, violations: [], riskLevel: 'low' };
    }

    let riskLevel = 'low';
    if (userThreat.score >= 20) riskLevel = 'critical';
    else if (userThreat.score >= 10) riskLevel = 'high';
    else if (userThreat.score >= 5) riskLevel = 'medium';

    return {
      score: userThreat.score,
      violations: userThreat.violations.length,
      riskLevel: riskLevel,
      lastViolation: userThreat.lastViolation
    };
  }

  /**
   * 获取安全统计信息
   * @returns {Object} 统计信息
   */
  getSecurityStats() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    const recentEvents = this.securityLog.filter(e => 
      new Date(e.timestamp).getTime() > oneHourAgo
    );

    const dailyEvents = this.securityLog.filter(e => 
      new Date(e.timestamp).getTime() > oneDayAgo
    );

    return {
      totalEvents: this.securityLog.length,
      recentEvents: recentEvents.length,
      dailyEvents: dailyEvents.length,
      blockedUsers: this.blockedUsers.size,
      highRiskUsers: Array.from(this.userThreatScores.entries())
        .filter(([_, threat]) => threat.score >= 10).length
    };
  }

  /**
   * 启动清理任务
   */
  startCleanupTasks() {
    // 每小时清理过期的威胁评分
    setInterval(() => {
      this.cleanupExpiredThreatScores();
    }, 60 * 60 * 1000);

    // 每天轮转日志文件
    setInterval(() => {
      this.rotateLogFile();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * 清理过期的威胁评分
   */
  cleanupExpiredThreatScores() {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    for (const [userId, threat] of this.userThreatScores.entries()) {
      if (threat.lastViolation && threat.lastViolation < sevenDaysAgo) {
        this.userThreatScores.delete(userId);
      }
    }
  }

  /**
   * 轮转日志文件
   */
  rotateLogFile() {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const archivePath = this.threatConfig.logFilePath.replace('.log', `_${timestamp}.log`);
      
      if (fs.existsSync(this.threatConfig.logFilePath)) {
        fs.renameSync(this.threatConfig.logFilePath, archivePath);
      }
    } catch (error) {
      console.error('日志轮转失败:', error);
    }
  }

  /**
   * 生成事件ID
   * @returns {string} 事件ID
   */
  generateEventId() {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = SecurityMonitor;
