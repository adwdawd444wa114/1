const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const TerminalManager = require('./lib/terminal-manager');
const SessionManager = require('./lib/session-manager');

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

// 终端管理器和会话管理器
const terminalManager = new TerminalManager();
const sessionManager = new SessionManager();

// 主页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

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

  // 可以在这里添加更多安全处理逻辑，比如：
  // 1. 记录到安全日志文件
  // 2. 发送邮件通知管理员
  // 3. 临时限制用户权限
  // 4. 广播安全警告给其他用户（可选）

  // 广播安全事件给所有用户（可选，用于透明度）
  io.emit('security-alert', {
    message: `用户 ${violationData.ownerName} 尝试执行了被禁止的命令`,
    timestamp: violationData.timestamp,
    severity: 'warning'
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 LinuxDo 网络自习室服务器运行在端口 ${PORT}`);
  console.log(`🔗 访问 http://localhost:${PORT} 开始使用`);
  console.log(`🛡️ 安全过滤器已启用，危险命令将被自动拦截`);
});
