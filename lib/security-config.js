/**
 * 安全配置文件
 * 集中管理所有安全相关的配置和策略
 */

const SecurityConfig = {
  // 命令过滤配置
  commandFilter: {
    // 是否启用严格模式（白名单模式）
    strictMode: false,
    
    // 是否启用编码检测
    enableEncodingDetection: true,
    
    // 是否启用序列攻击检测
    enableSequenceDetection: true,
    
    // 最大命令长度
    maxCommandLength: 1000,
    
    // 最大特殊字符数量
    maxSpecialChars: 10,
    
    // 命令历史记录大小
    historySize: 10
  },

  // 速率限制配置
  rateLimit: {
    // 每分钟最大命令数
    maxCommandsPerMinute: 60,
    
    // 每分钟最大危险命令尝试数
    maxDangerousAttemptsPerMinute: 3,
    
    // 封禁持续时间（分钟）
    blockDurationMinutes: 5,
    
    // 是否启用渐进式封禁（重复违规时间递增）
    enableProgressiveBlocking: true,
    
    // 渐进式封禁倍数
    progressiveBlockingMultiplier: 2
  },

  // 威胁检测配置
  threatDetection: {
    // 自动封禁阈值（短时间内违规次数）
    autoBlockThreshold: 3,
    
    // 威胁评分阈值
    threatScoreThresholds: {
      low: 0,
      medium: 5,
      high: 10,
      critical: 20
    },
    
    // 威胁评分衰减时间（小时）
    scoreDecayHours: 24,
    
    // 最大用户违规记录数
    maxViolationsPerUser: 5,
    
    // 最大系统违规记录数（每分钟）
    maxViolationsPerMinute: 10
  },

  // 日志配置
  logging: {
    // 是否启用文件日志
    enableFileLogging: true,
    
    // 日志文件路径
    logFilePath: './logs/security.log',
    
    // 最大日志文件大小（MB）
    maxLogFileSize: 100,
    
    // 日志保留天数
    logRetentionDays: 30,
    
    // 是否启用日志轮转
    enableLogRotation: true,
    
    // 日志级别
    logLevel: 'info', // debug, info, warn, error
    
    // 是否记录正常命令
    logNormalCommands: false
  },

  // 监控配置
  monitoring: {
    // 是否启用实时监控
    enableRealTimeMonitoring: true,
    
    // 监控数据保留时间（小时）
    dataRetentionHours: 168, // 7天
    
    // 是否启用性能监控
    enablePerformanceMonitoring: true,
    
    // 统计数据更新间隔（秒）
    statsUpdateInterval: 60,
    
    // 是否启用内存使用监控
    enableMemoryMonitoring: true
  },

  // 通知配置
  notifications: {
    // 是否启用安全事件通知
    enableSecurityNotifications: true,
    
    // 是否向所有用户广播安全事件
    broadcastSecurityEvents: true,
    
    // 是否启用封禁通知
    enableBlockNotifications: true,
    
    // 通知级别阈值
    notificationThreshold: 'medium', // low, medium, high, critical
    
    // 是否启用邮件通知（需要配置邮件服务）
    enableEmailNotifications: false,
    
    // 邮件配置
    email: {
      smtp: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'security@example.com',
          pass: 'password'
        }
      },
      from: 'security@example.com',
      to: ['admin@example.com']
    }
  },

  // 终端安全配置
  terminal: {
    // 是否启用终端隔离
    enableTerminalIsolation: true,
    
    // 最大终端数量（每用户）
    maxTerminalsPerUser: 1,
    
    // 终端超时时间（分钟）
    terminalTimeoutMinutes: 30,
    
    // 是否启用命令审计
    enableCommandAudit: true,
    
    // 是否限制文件系统访问
    restrictFileSystemAccess: false,
    
    // 允许访问的目录列表
    allowedDirectories: [
      '/home',
      '/tmp',
      '/var/tmp'
    ],
    
    // 禁止访问的目录列表
    forbiddenDirectories: [
      '/etc',
      '/root',
      '/boot',
      '/sys',
      '/proc'
    ]
  },

  // 网络安全配置
  network: {
    // 是否启用IP白名单
    enableIPWhitelist: false,
    
    // IP白名单
    ipWhitelist: [
      '127.0.0.1',
      '::1'
    ],
    
    // 是否启用IP黑名单
    enableIPBlacklist: false,
    
    // IP黑名单
    ipBlacklist: [],
    
    // 是否启用地理位置限制
    enableGeoRestriction: false,
    
    // 允许的国家代码
    allowedCountries: ['CN', 'US'],
    
    // 是否启用连接频率限制
    enableConnectionRateLimit: true,
    
    // 每IP每分钟最大连接数
    maxConnectionsPerIP: 10
  },

  // 会话安全配置
  session: {
    // 会话超时时间（分钟）
    sessionTimeoutMinutes: 30,
    
    // 是否启用会话固定保护
    enableSessionFixationProtection: true,
    
    // 最大并发会话数（每用户）
    maxConcurrentSessions: 1,
    
    // 是否启用会话加密
    enableSessionEncryption: false,
    
    // 会话密钥
    sessionSecret: 'your-secret-key-here'
  },

  // 开发和调试配置
  development: {
    // 是否启用调试模式
    enableDebugMode: false,
    
    // 是否启用详细日志
    enableVerboseLogging: false,
    
    // 是否禁用某些安全检查（仅开发环境）
    disableSecurityChecks: false,
    
    // 测试用户列表（开发环境下自动通过安全检查）
    testUsers: ['test', 'demo', 'admin']
  },

  // 性能配置
  performance: {
    // 是否启用缓存
    enableCaching: true,
    
    // 缓存过期时间（秒）
    cacheExpirationSeconds: 300,
    
    // 最大缓存大小
    maxCacheSize: 1000,
    
    // 是否启用压缩
    enableCompression: true,
    
    // 是否启用异步处理
    enableAsyncProcessing: true
  }
};

// 环境特定配置覆盖
if (process.env.NODE_ENV === 'development') {
  SecurityConfig.development.enableDebugMode = true;
  SecurityConfig.development.enableVerboseLogging = true;
  SecurityConfig.logging.logLevel = 'debug';
  SecurityConfig.rateLimit.maxCommandsPerMinute = 120; // 开发环境放宽限制
}

if (process.env.NODE_ENV === 'production') {
  SecurityConfig.commandFilter.strictMode = true; // 生产环境启用严格模式
  SecurityConfig.logging.enableFileLogging = true;
  SecurityConfig.notifications.enableEmailNotifications = true;
  SecurityConfig.network.enableConnectionRateLimit = true;
}

// 配置验证函数
SecurityConfig.validate = function() {
  const errors = [];
  
  // 验证必要的配置项
  if (this.rateLimit.maxCommandsPerMinute <= 0) {
    errors.push('maxCommandsPerMinute must be greater than 0');
  }
  
  if (this.threatDetection.autoBlockThreshold <= 0) {
    errors.push('autoBlockThreshold must be greater than 0');
  }
  
  if (this.logging.enableFileLogging && !this.logging.logFilePath) {
    errors.push('logFilePath is required when file logging is enabled');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

// 获取配置的便捷方法
SecurityConfig.get = function(path) {
  const keys = path.split('.');
  let value = this;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
};

module.exports = SecurityConfig;
