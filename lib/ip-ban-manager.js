const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

/**
 * IP封禁管理器
 * 实施基于IP的封禁策略，防止恶意用户
 */
class IPBanManager extends EventEmitter {
  constructor() {
    super();
    
    // IP封禁配置
    this.banConfig = {
      // 触发封禁的违规次数
      maxViolations: 3,
      // 封禁时间（小时）
      banDurationHours: 24,
      // 永久封禁阈值（重复封禁次数）
      permanentBanThreshold: 3,
      // 封禁数据文件
      banDataFile: path.join(process.cwd(), 'data', 'ip-bans.json')
    };
    
    // IP违规记录 {ip: {violations: [], banCount: 0, lastBan: null}}
    this.ipViolations = new Map();
    
    // 当前封禁列表 {ip: {bannedAt: timestamp, duration: hours, reason: string, permanent: boolean}}
    this.bannedIPs = new Map();
    
    // 白名单IP（永不封禁）
    this.whitelistIPs = new Set([
      '127.0.0.1',
      '::1',
      'localhost'
    ]);
    
    // 确保数据目录存在
    this.ensureDataDirectory();
    
    // 加载封禁数据
    this.loadBanData();
    
    // 启动清理任务
    this.startCleanupTasks();
  }

  /**
   * 确保数据目录存在
   */
  ensureDataDirectory() {
    const dataDir = path.dirname(this.banConfig.banDataFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  /**
   * 记录IP违规
   * @param {string} ip - IP地址
   * @param {Object} violation - 违规信息
   */
  recordViolation(ip, violation) {
    // 检查是否在白名单
    if (this.whitelistIPs.has(ip)) {
      console.log(`⚪ IP ${ip} 在白名单中，跳过违规记录`);
      return;
    }

    if (!this.ipViolations.has(ip)) {
      this.ipViolations.set(ip, {
        violations: [],
        banCount: 0,
        lastBan: null
      });
    }

    const ipData = this.ipViolations.get(ip);
    
    // 添加违规记录
    ipData.violations.push({
      ...violation,
      timestamp: Date.now()
    });

    // 清理过期违规记录（24小时前）
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    ipData.violations = ipData.violations.filter(v => v.timestamp > oneDayAgo);

    console.log(`🚨 记录IP违规: ${ip} (${ipData.violations.length}/${this.banConfig.maxViolations})`);

    // 检查是否需要封禁
    if (ipData.violations.length >= this.banConfig.maxViolations) {
      this.banIP(ip, '多次安全违规', false);
    }

    // 保存数据
    this.saveBanData();
  }

  /**
   * 封禁IP
   * @param {string} ip - IP地址
   * @param {string} reason - 封禁原因
   * @param {boolean} permanent - 是否永久封禁
   */
  banIP(ip, reason, permanent = false) {
    // 检查是否在白名单
    if (this.whitelistIPs.has(ip)) {
      console.log(`⚪ IP ${ip} 在白名单中，无法封禁`);
      return false;
    }

    const ipData = this.ipViolations.get(ip) || { violations: [], banCount: 0, lastBan: null };
    
    // 增加封禁计数
    ipData.banCount++;
    ipData.lastBan = Date.now();

    // 检查是否应该永久封禁
    if (!permanent && ipData.banCount >= this.banConfig.permanentBanThreshold) {
      permanent = true;
      reason += ' (重复违规，永久封禁)';
    }

    const banInfo = {
      bannedAt: Date.now(),
      duration: permanent ? 0 : this.banConfig.banDurationHours,
      reason: reason,
      permanent: permanent,
      banCount: ipData.banCount
    };

    this.bannedIPs.set(ip, banInfo);
    this.ipViolations.set(ip, ipData);

    // 触发封禁事件
    this.emit('ip-banned', {
      ip: ip,
      reason: reason,
      permanent: permanent,
      banCount: ipData.banCount,
      timestamp: banInfo.bannedAt
    });

    console.log(`🚫 IP已封禁: ${ip} - ${reason} ${permanent ? '(永久)' : `(${this.banConfig.banDurationHours}小时)`}`);

    // 保存数据
    this.saveBanData();
    
    return true;
  }

  /**
   * 检查IP是否被封禁
   * @param {string} ip - IP地址
   * @returns {Object|null} 封禁信息或null
   */
  isIPBanned(ip) {
    const banInfo = this.bannedIPs.get(ip);
    if (!banInfo) {
      return null;
    }

    // 检查是否永久封禁
    if (banInfo.permanent) {
      return banInfo;
    }

    // 检查临时封禁是否过期
    const banExpiry = banInfo.bannedAt + (banInfo.duration * 60 * 60 * 1000);
    if (Date.now() > banExpiry) {
      // 封禁已过期，移除
      this.bannedIPs.delete(ip);
      this.saveBanData();
      return null;
    }

    return banInfo;
  }

  /**
   * 解封IP
   * @param {string} ip - IP地址
   * @returns {boolean} 是否成功解封
   */
  unbanIP(ip) {
    if (this.bannedIPs.has(ip)) {
      this.bannedIPs.delete(ip);
      
      // 触发解封事件
      this.emit('ip-unbanned', {
        ip: ip,
        timestamp: Date.now()
      });

      console.log(`✅ IP已解封: ${ip}`);
      this.saveBanData();
      return true;
    }
    return false;
  }

  /**
   * 添加IP到白名单
   * @param {string} ip - IP地址
   */
  addToWhitelist(ip) {
    this.whitelistIPs.add(ip);
    // 如果IP当前被封禁，则解封
    if (this.bannedIPs.has(ip)) {
      this.unbanIP(ip);
    }
    console.log(`⚪ IP已添加到白名单: ${ip}`);
  }

  /**
   * 从白名单移除IP
   * @param {string} ip - IP地址
   */
  removeFromWhitelist(ip) {
    this.whitelistIPs.delete(ip);
    console.log(`🔴 IP已从白名单移除: ${ip}`);
  }

  /**
   * 获取IP统计信息
   * @param {string} ip - IP地址
   * @returns {Object} 统计信息
   */
  getIPStats(ip) {
    const violations = this.ipViolations.get(ip);
    const banInfo = this.bannedIPs.get(ip);
    
    return {
      ip: ip,
      violations: violations ? violations.violations.length : 0,
      banCount: violations ? violations.banCount : 0,
      lastBan: violations ? violations.lastBan : null,
      currentlyBanned: !!banInfo,
      banInfo: banInfo || null,
      whitelisted: this.whitelistIPs.has(ip)
    };
  }

  /**
   * 获取所有封禁统计
   * @returns {Object} 统计信息
   */
  getBanStats() {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    let activeBans = 0;
    let permanentBans = 0;
    let recentBans = 0;
    
    for (const [ip, banInfo] of this.bannedIPs) {
      if (banInfo.permanent) {
        permanentBans++;
        activeBans++;
      } else {
        const banExpiry = banInfo.bannedAt + (banInfo.duration * 60 * 60 * 1000);
        if (now < banExpiry) {
          activeBans++;
        }
      }
      
      if (banInfo.bannedAt > oneDayAgo) {
        recentBans++;
      }
    }
    
    return {
      totalBannedIPs: this.bannedIPs.size,
      activeBans: activeBans,
      permanentBans: permanentBans,
      recentBans: recentBans,
      whitelistedIPs: this.whitelistIPs.size,
      totalViolatingIPs: this.ipViolations.size
    };
  }

  /**
   * 保存封禁数据到文件
   */
  saveBanData() {
    try {
      const data = {
        bannedIPs: Array.from(this.bannedIPs.entries()),
        ipViolations: Array.from(this.ipViolations.entries()),
        whitelistIPs: Array.from(this.whitelistIPs),
        lastSaved: Date.now()
      };
      
      fs.writeFileSync(this.banConfig.banDataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('保存封禁数据失败:', error);
    }
  }

  /**
   * 从文件加载封禁数据
   */
  loadBanData() {
    try {
      if (fs.existsSync(this.banConfig.banDataFile)) {
        const data = JSON.parse(fs.readFileSync(this.banConfig.banDataFile, 'utf8'));
        
        this.bannedIPs = new Map(data.bannedIPs || []);
        this.ipViolations = new Map(data.ipViolations || []);
        this.whitelistIPs = new Set(data.whitelistIPs || ['127.0.0.1', '::1', 'localhost']);
        
        console.log(`📂 已加载封禁数据: ${this.bannedIPs.size}个封禁IP, ${this.ipViolations.size}个违规记录`);
      }
    } catch (error) {
      console.error('加载封禁数据失败:', error);
    }
  }

  /**
   * 启动清理任务
   */
  startCleanupTasks() {
    // 每小时清理过期的封禁和违规记录
    setInterval(() => {
      this.cleanupExpiredData();
    }, 60 * 60 * 1000);
  }

  /**
   * 清理过期数据
   */
  cleanupExpiredData() {
    const now = Date.now();
    let cleanedBans = 0;
    let cleanedViolations = 0;

    // 清理过期的临时封禁
    for (const [ip, banInfo] of this.bannedIPs) {
      if (!banInfo.permanent) {
        const banExpiry = banInfo.bannedAt + (banInfo.duration * 60 * 60 * 1000);
        if (now > banExpiry) {
          this.bannedIPs.delete(ip);
          cleanedBans++;
        }
      }
    }

    // 清理过期的违规记录（保留7天）
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    for (const [ip, ipData] of this.ipViolations) {
      const originalLength = ipData.violations.length;
      ipData.violations = ipData.violations.filter(v => v.timestamp > sevenDaysAgo);
      
      if (ipData.violations.length === 0 && (!ipData.lastBan || ipData.lastBan < sevenDaysAgo)) {
        this.ipViolations.delete(ip);
        cleanedViolations++;
      }
    }

    if (cleanedBans > 0 || cleanedViolations > 0) {
      console.log(`🧹 清理过期数据: ${cleanedBans}个过期封禁, ${cleanedViolations}个过期违规记录`);
      this.saveBanData();
    }
  }
}

module.exports = IPBanManager;
