# WebSSH 多用户终端

一个基于Web的多用户SSH终端应用，支持实时协作和权限控制。

## 功能特点

- ✅ **多用户支持**: 每个用户拥有独立的终端会话
- ✅ **权限控制**: 用户只能控制自己的终端，但可以查看其他用户的终端输出
- ✅ **命令过滤**: 自动拦截危险命令，如 `rm -rf`、`shutdown` 等
- ✅ **实时同步**: 所有用户可以实时看到其他终端的输出
- ✅ **响应式设计**: 支持桌面和移动设备
- ✅ **现代界面**: 基于 xterm.js 的现代终端界面

## 技术栈

- **后端**: Node.js + Express + Socket.IO + node-pty
- **前端**: HTML5 + CSS3 + JavaScript + xterm.js
- **实时通信**: Socket.IO
- **终端模拟**: node-pty (伪终端) + xterm.js (前端终端)

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务器

```bash
npm start
```

### 访问应用

打开浏览器访问: http://localhost:3000

## 使用说明

1. **登录**: 输入用户名加入终端会话
2. **终端控制**:
   - 绿色边框的终端是你的终端，可以输入命令
   - 蓝色边框的终端是其他用户的终端，只能查看
3. **用户列表**: 左侧显示所有在线用户
4. **终端列表**: 显示所有活跃的终端会话
5. **命令安全**: 危险命令会被自动拦截并显示警告

## 安全特性

### 被拦截的危险命令

- **删除命令**: `rm -rf`, `rmdir`, `del /s` 等
- **系统控制**: `shutdown`, `reboot`, `halt` 等
- **磁盘操作**: `mkfs`, `format`, `fdisk` 等
- **权限修改**: `chmod 777 /`, `chown root /` 等
- **进程控制**: `kill -9 1`, `killall -9` 等
- **网络攻击**: `dd if=/dev/zero`, fork bomb 等

### 权限控制

- 每个用户只能控制自己的终端
- 所有用户都可以查看其他终端的输出
- 会话隔离，互不干扰

## 项目结构

```
/
├── package.json          # 项目配置
├── server.js             # 主服务器文件
├── public/               # 前端静态文件
│   ├── index.html        # 主页面
│   ├── style.css         # 样式文件
│   └── client.js         # 客户端逻辑
└── lib/                  # 后端模块
    ├── terminal-manager.js   # 终端管理器
    ├── command-filter.js     # 命令过滤器
    └── session-manager.js    # 会话管理器
```

## 配置选项

### 环境变量

- `PORT`: 服务器端口 (默认: 3000)

### 自定义配置

可以在 `lib/command-filter.js` 中添加或修改危险命令列表。

## 开发

### 启动开发服务器

```bash
npm run dev
```

### 添加新的危险命令

在 `lib/command-filter.js` 中的 `dangerousCommands` 数组中添加新命令。

### 修改终端样式

编辑 `public/style.css` 中的终端相关样式。

## 注意事项

1. 本应用仅用于演示和学习目的
2. 生产环境使用需要额外的安全措施
3. 建议在受控环境中运行
4. 定期更新依赖包以修复安全漏洞

## 许可证

ISC License