const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const TerminalManager = require('./lib/terminal-manager');
const SessionManager = require('./lib/session-manager');
const SecurityMonitor = require('./lib/security-monitor');
const IPBanManager = require('./lib/ip-ban-manager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 静态文件服务
app.use(express.static('public'));

// 终端管理器、会话管理器、安全监控器和IP封禁管理器
const terminalManager = new TerminalManager();
const sessionManager = new SessionManager();
const securityMonitor = new SecurityMonitor();
const ipBanManager = new IPBanManager();

// 主页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  const clientIP = socket.handshake.address || socket.request.connection.remoteAddress;
  console.log(`用户连接: ${socket.id} (IP: ${clientIP})`);

  // 检查IP是否被封禁
  const banInfo = ipBanManager.isIPBanned(clientIP);
  if (banInfo) {
    console.log(`🚫 封禁IP尝试连接: ${clientIP}`);
    socket.emit('ip-banned', {
      reason: banInfo.reason,
      bannedAt: banInfo.bannedAt,
      permanent: banInfo.permanent,
      duration: banInfo.duration
    });
    socket.disconnect(true);
    return;
  }

  // 用户加入
  socket.on('join', (username) => {
    if (!username || username.trim() === '') {
      socket.emit('error', '用户名不能为空');
      return;
    }

    // 检查用户名是否已存在
    if (sessionManager.isUserExists(username)) {
      socket.emit('error', '用户名已存在，请选择其他用户名');
      return;
    }

    // 创建用户会话
    const session = sessionManager.createSession(socket.id, username);

    // 检查用户是否被安全监控器封禁
    if (securityMonitor.isUserBlocked(session.userId)) {
      socket.emit('error', '您已被系统封禁，无法连接');
      sessionManager.removeSession(socket.id);
      return;
    }

    // 创建用户专属终端
    const terminal = terminalManager.createTerminal(session.userId, username);

    socket.join(session.userId); // 加入房间
    socket.username = username;
    socket.userId = session.userId;

    // 发送连接成功消息
    socket.emit('joined', {
      userId: session.userId,
      username: username,
      terminalId: terminal.id
    });

    // 广播用户列表更新
    io.emit('users-update', sessionManager.getAllUsers());

    // 广播终端列表更新
    io.emit('terminals-update', terminalManager.getAllTerminals());

    console.log(`用户 ${username} (${session.userId}) 已连接`);
  });

  // 终端输入处理
  socket.on('terminal-input', (data) => {
    const { terminalId, input } = data;
    const session = sessionManager.getSessionBySocketId(socket.id);

    if (!session) {
      socket.emit('error', '未找到用户会话');
      return;
    }

    // 检查权限：只能控制自己的终端
    const terminal = terminalManager.getTerminal(terminalId);
    if (!terminal || terminal.ownerId !== session.userId) {
      socket.emit('error', '无权限控制此终端');
      return;
    }

    // 写入终端
    terminalManager.writeToTerminal(terminalId, input);
  });

  // 请求终端列表
  socket.on('get-terminals', () => {
    socket.emit('terminals-update', terminalManager.getAllTerminals());
  });

  // 请求用户列表
  socket.on('get-users', () => {
    socket.emit('users-update', sessionManager.getAllUsers());
  });

  // 断开连接处理
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);

    const session = sessionManager.getSessionBySocketId(socket.id);
    if (session) {
      // 关闭用户的终端
      terminalManager.closeTerminal(session.userId);

      // 删除会话
      sessionManager.removeSession(socket.id);

      // 广播更新
      io.emit('users-update', sessionManager.getAllUsers());
      io.emit('terminals-update', terminalManager.getAllTerminals());

      console.log(`用户 ${session.username} 已断开连接`);
    }
  });
});

// 监听终端输出事件
terminalManager.on('terminal-output', (terminalId, data) => {
  // 广播终端输出给所有用户（只读模式给其他用户）
  io.emit('terminal-output', {
    terminalId: terminalId,
    data: data
  });
});

// 监听终端关闭事件
terminalManager.on('terminal-closed', (terminalId) => {
  io.emit('terminal-closed', terminalId);
});

// 监听安全违规事件
terminalManager.on('security-violation', (violationData) => {
  console.log(`🚨 安全违规: 用户 ${violationData.ownerName} 尝试执行危险命令: ${violationData.command}`);

  // 获取用户IP地址
  const session = sessionManager.getSessionByUserId(violationData.ownerId);
  let clientIP = 'unknown';
  if (session) {
    const socket = io.sockets.sockets.get(session.socketId);
    if (socket) {
      clientIP = socket.handshake.address || socket.request.connection.remoteAddress;
    }
  }

  // 记录IP违规
  ipBanManager.recordViolation(clientIP, {
    type: 'command-violation',
    ownerId: violationData.ownerId,
    ownerName: violationData.ownerName,
    command: violationData.command,
    reason: violationData.reason,
    severity: violationData.severity,
    terminalId: violationData.terminalId
  });

  // 记录到安全监控器
  securityMonitor.logSecurityEvent({
    type: 'command-violation',
    ownerId: violationData.ownerId,
    ownerName: violationData.ownerName,
    command: violationData.command,
    reason: violationData.reason,
    severity: violationData.severity,
    terminalId: violationData.terminalId,
    rateLimitStatus: violationData.rateLimitStatus,
    ipAddress: clientIP
  });

  // 广播安全事件给所有用户（可选，用于透明度）
  io.emit('security-alert', {
    message: `用户 ${violationData.ownerName} 尝试执行了被禁止的命令`,
    timestamp: violationData.timestamp,
    severity: violationData.severity,
    command: violationData.command.substring(0, 50) + (violationData.command.length > 50 ? '...' : ''),
    ipAddress: clientIP.substring(0, 10) + '...' // 部分隐藏IP
  });
});

// 监听安全监控器事件
securityMonitor.on('user-blocked', (blockData) => {
  console.log(`🚫 用户被自动封禁: ${blockData.userId} - ${blockData.reason}`);

  // 断开被封禁用户的连接
  const session = sessionManager.getSessionByUserId(blockData.userId);
  if (session) {
    const socket = io.sockets.sockets.get(session.socketId);
    if (socket) {
      socket.emit('force-disconnect', {
        reason: '您已被系统自动封禁',
        details: blockData.reason
      });
      socket.disconnect(true);
    }
  }

  // 广播封禁通知
  io.emit('user-blocked-notification', {
    message: '系统检测到恶意行为，已自动封禁相关用户',
    timestamp: blockData.timestamp
  });
});

// 监听IP封禁事件
ipBanManager.on('ip-banned', (banData) => {
  console.log(`🚫 IP已被封禁: ${banData.ip} - ${banData.reason} ${banData.permanent ? '(永久)' : ''}`);

  // 断开该IP的所有连接
  for (const [socketId, socket] of io.sockets.sockets) {
    const socketIP = socket.handshake.address || socket.request.connection.remoteAddress;
    if (socketIP === banData.ip) {
      socket.emit('ip-force-disconnect', {
        reason: '您的IP地址已被封禁',
        details: banData.reason,
        permanent: banData.permanent,
        banCount: banData.banCount
      });
      socket.disconnect(true);
    }
  }

  // 广播IP封禁通知（隐藏完整IP）
  io.emit('ip-ban-notification', {
    message: `检测到恶意行为，IP ${banData.ip.substring(0, 8)}... 已被封禁`,
    permanent: banData.permanent,
    timestamp: banData.timestamp
  });
});

ipBanManager.on('ip-unbanned', (unbanData) => {
  console.log(`✅ IP已解封: ${unbanData.ip}`);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 LinuxDo 网络自习室服务器运行在端口 ${PORT}`);
  console.log(`🔗 访问 http://localhost:${PORT} 开始使用`);
  console.log(`🛡️ 安全过滤器已启用，危险命令将被自动拦截`);
});
