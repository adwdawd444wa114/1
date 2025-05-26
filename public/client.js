class WebSSHClient {
    constructor() {
        this.socket = null;
        this.terminals = new Map(); // terminalId -> { xterm, fitAddon, isOwn }
        this.currentUser = null;
        this.users = [];
        this.terminalsList = [];

        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        // 登录界面元素
        this.loginContainer = document.getElementById('login-container');
        this.mainContainer = document.getElementById('main-container');
        this.usernameInput = document.getElementById('username-input');
        this.joinBtn = document.getElementById('join-btn');
        this.loginError = document.getElementById('login-error');

        // 主界面元素
        this.currentUserSpan = document.getElementById('current-user');
        this.onlineCountSpan = document.getElementById('online-count');
        this.logoutBtn = document.getElementById('logout-btn');
        this.usersListDiv = document.getElementById('users-list');
        this.terminalsListDiv = document.getElementById('terminals-list');
        this.terminalsContainer = document.getElementById('terminals-container');
        this.statusMessage = document.getElementById('status-message');
    }

    bindEvents() {
        // 登录事件
        this.joinBtn.addEventListener('click', () => this.join());
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.join();
        });

        // 退出事件
        this.logoutBtn.addEventListener('click', () => this.logout());

        // 窗口大小变化事件
        window.addEventListener('resize', () => this.resizeAllTerminals());
    }

    join() {
        const username = this.usernameInput.value.trim();
        if (!username) {
            this.showLoginError('请输入用户名');
            return;
        }

        if (username.length > 20) {
            this.showLoginError('用户名不能超过20个字符');
            return;
        }

        // 连接Socket.IO
        this.socket = io();
        this.bindSocketEvents();

        // 发送加入请求
        this.socket.emit('join', username);

        this.joinBtn.disabled = true;
        this.joinBtn.textContent = '连接中...';
    }

    bindSocketEvents() {
        // 连接成功
        this.socket.on('joined', (data) => {
            this.currentUser = data;
            this.showMainInterface();
            this.showStatus('连接成功！', 'success');
            // 显示欢迎通知
            this.showWelcomeNotification();
        });

        // 连接错误
        this.socket.on('error', (message) => {
            this.showLoginError(message);
            this.joinBtn.disabled = false;
            this.joinBtn.textContent = '加入';
        });

        // 用户列表更新
        this.socket.on('users-update', (users) => {
            this.users = users;
            this.updateUsersList();
            this.updateOnlineCount();
        });

        // 终端列表更新
        this.socket.on('terminals-update', (terminals) => {
            this.terminalsList = terminals;
            this.updateTerminalsList();
            this.updateTerminalsDisplay();
        });

        // 终端输出
        this.socket.on('terminal-output', (data) => {
            this.handleTerminalOutput(data.terminalId, data.data);
        });

        // 终端关闭
        this.socket.on('terminal-closed', (terminalId) => {
            this.removeTerminal(terminalId);
        });

        // 安全警告
        this.socket.on('security-alert', (alertData) => {
            this.showStatus(`🚨 ${alertData.message}`, 'warning');
        });

        // 断开连接
        this.socket.on('disconnect', () => {
            this.showStatus('连接已断开', 'error');
            setTimeout(() => {
                this.logout();
            }, 2000);
        });
    }

    showMainInterface() {
        this.loginContainer.style.display = 'none';
        this.mainContainer.style.display = 'flex';
        this.currentUserSpan.textContent = this.currentUser.username;

        // 请求初始数据
        this.socket.emit('get-users');
        this.socket.emit('get-terminals');
    }

    updateUsersList() {
        this.usersListDiv.innerHTML = '';

        this.users.forEach(user => {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item';
            if (user.userId === this.currentUser.userId) {
                userDiv.classList.add('current-user');
            }

            userDiv.innerHTML = `
                <div style="font-weight: bold;">${user.username}</div>
                <div style="font-size: 12px; color: #666;">
                    ${user.userId === this.currentUser.userId ? '(你)' : ''}
                    ${new Date(user.createdAt).toLocaleTimeString()}
                </div>
            `;

            this.usersListDiv.appendChild(userDiv);
        });
    }

    updateTerminalsList() {
        this.terminalsListDiv.innerHTML = '';

        this.terminalsList.forEach(terminal => {
            const terminalDiv = document.createElement('div');
            terminalDiv.className = 'terminal-item';

            const isOwn = terminal.ownerId === this.currentUser.userId;
            if (isOwn) {
                terminalDiv.classList.add('own-terminal');
            }

            terminalDiv.innerHTML = `
                <div style="font-weight: bold;">${terminal.ownerName}的终端</div>
                <div style="font-size: 12px; color: #666;">
                    ${isOwn ? '可控制' : '只读'}
                    ${new Date(terminal.createdAt).toLocaleTimeString()}
                </div>
            `;

            terminalDiv.addEventListener('click', () => {
                this.scrollToTerminal(terminal.id);
            });

            this.terminalsListDiv.appendChild(terminalDiv);
        });
    }

    updateTerminalsDisplay() {
        // 移除不存在的终端
        for (const [terminalId, terminalInfo] of this.terminals) {
            if (!this.terminalsList.find(t => t.id === terminalId)) {
                this.removeTerminal(terminalId);
            }
        }

        // 按照自己的终端优先排序
        const sortedTerminals = [...this.terminalsList].sort((a, b) => {
            const aIsOwn = a.ownerId === this.currentUser.userId;
            const bIsOwn = b.ownerId === this.currentUser.userId;

            if (aIsOwn && !bIsOwn) return -1; // 自己的终端排在前面
            if (!aIsOwn && bIsOwn) return 1;
            return a.createdAt.localeCompare(b.createdAt); // 其他按创建时间排序
        });

        // 添加新终端（按排序后的顺序）
        sortedTerminals.forEach(terminal => {
            if (!this.terminals.has(terminal.id)) {
                this.createTerminal(terminal);
            }
        });

        // 重新排序现有终端
        this.reorderTerminals(sortedTerminals);
    }

    createTerminal(terminalInfo) {
        const isOwn = terminalInfo.ownerId === this.currentUser.userId;

        // 创建终端包装器
        const wrapper = document.createElement('div');
        wrapper.className = `terminal-wrapper ${isOwn ? 'own-terminal' : 'readonly-terminal'}`;
        wrapper.id = `wrapper-${terminalInfo.id}`;

        // 创建终端头部
        const header = document.createElement('div');
        header.className = 'terminal-header';
        header.innerHTML = `
            <div class="terminal-title">${terminalInfo.ownerName}的终端</div>
            <div class="terminal-status ${isOwn ? 'writable' : 'readonly'}">
                ${isOwn ? '可控制' : '只读'}
            </div>
        `;

        // 创建终端内容区域
        const content = document.createElement('div');
        content.className = 'terminal-content';
        content.id = `terminal-${terminalInfo.id}`;

        wrapper.appendChild(header);
        wrapper.appendChild(content);
        this.terminalsContainer.appendChild(wrapper);

        // 创建xterm实例
        const xterm = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            theme: {
                background: '#000000',
                foreground: '#ffffff',
                cursor: '#ffffff',
                selection: '#ffffff40'
            },
            allowTransparency: true,
            disableStdin: !isOwn, // 非所有者禁用输入
            convertEol: false, // 禁用自动换行转换
            screenReaderMode: false,
            macOptionIsMeta: true,
            rightClickSelectsWord: false,
            fastScrollModifier: 'alt'
        });

        const fitAddon = new FitAddon.FitAddon();
        xterm.loadAddon(fitAddon);

        xterm.open(content);
        fitAddon.fit();

        // 绑定输入事件（仅对自己的终端）
        if (isOwn) {
            let lastInputTime = 0;
            let lastInputData = '';

            xterm.onData((data) => {
                const now = Date.now();

                // 防止重复输入：如果相同数据在50ms内重复，则忽略
                if (data === lastInputData && (now - lastInputTime) < 50) {
                    return;
                }

                lastInputTime = now;
                lastInputData = data;

                this.socket.emit('terminal-input', {
                    terminalId: terminalInfo.id,
                    input: data
                });
            });
        }

        // 保存终端信息
        this.terminals.set(terminalInfo.id, {
            xterm: xterm,
            fitAddon: fitAddon,
            isOwn: isOwn,
            wrapper: wrapper
        });

        console.log(`创建终端: ${terminalInfo.id} (${isOwn ? '可控制' : '只读'})`);
    }

    handleTerminalOutput(terminalId, data) {
        const terminal = this.terminals.get(terminalId);
        if (terminal) {
            terminal.xterm.write(data);
        }
    }

    removeTerminal(terminalId) {
        const terminal = this.terminals.get(terminalId);
        if (terminal) {
            terminal.xterm.dispose();
            terminal.wrapper.remove();
            this.terminals.delete(terminalId);
            console.log(`移除终端: ${terminalId}`);
        }
    }

    scrollToTerminal(terminalId) {
        const wrapper = document.getElementById(`wrapper-${terminalId}`);
        if (wrapper) {
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
            wrapper.style.transform = 'scale(1.02)';
            setTimeout(() => {
                wrapper.style.transform = 'scale(1)';
            }, 200);
        }
    }

    resizeAllTerminals() {
        for (const [terminalId, terminal] of this.terminals) {
            setTimeout(() => {
                terminal.fitAddon.fit();
            }, 100);
        }
    }

    updateOnlineCount() {
        this.onlineCountSpan.textContent = `在线: ${this.users.length}`;
    }

    showLoginError(message) {
        this.loginError.textContent = message;
        this.loginError.style.display = 'block';
        setTimeout(() => {
            this.loginError.style.display = 'none';
        }, 5000);
    }

    showStatus(message, type = 'info') {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type} show`;

        setTimeout(() => {
            this.statusMessage.classList.remove('show');
        }, 3000);
    }

    logout() {
        if (this.socket) {
            this.socket.disconnect();
        }

        // 清理全屏状态
        document.body.classList.remove('terminal-fullscreen');
        if (this.fullscreenKeyHandler) {
            document.removeEventListener('keydown', this.fullscreenKeyHandler);
            this.fullscreenKeyHandler = null;
        }

        // 清理终端
        for (const [terminalId, terminal] of this.terminals) {
            terminal.xterm.dispose();
        }
        this.terminals.clear();

        // 重置界面
        this.loginContainer.style.display = 'flex';
        this.mainContainer.style.display = 'none';
        this.usernameInput.value = '';
        this.joinBtn.disabled = false;
        this.joinBtn.textContent = '加入';
        this.terminalsContainer.innerHTML = '';

        this.currentUser = null;
        this.users = [];
        this.terminalsList = [];
    }

    // 显示欢迎通知
    showWelcomeNotification() {
        // 创建通知弹窗
        const notification = document.createElement('div');
        notification.className = 'welcome-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <h3>🎉 欢迎来到 LinuxDo 网络自习室！</h3>
                <p>这里是一个多用户协作的终端环境</p>
                <ul>
                    <li>✅ 你可以在自己的终端中执行命令</li>
                    <li>👀 可以观看其他用户的终端操作</li>
                    <li>🛡️ 危险命令会被自动拦截保护</li>
                    <li>🤝 与其他用户一起学习和交流</li>
                </ul>
                <button class="notification-close">开始使用</button>
            </div>
        `;

        document.body.appendChild(notification);

        // 绑定关闭事件
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        // 5秒后自动关闭
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.remove();
            }
        }, 8000);
    }

    // 重新排序终端
    reorderTerminals(sortedTerminals) {
        const container = this.terminalsContainer;

        // 按照排序顺序重新排列DOM元素
        sortedTerminals.forEach((terminal, index) => {
            const wrapper = document.getElementById(`wrapper-${terminal.id}`);
            if (wrapper) {
                // 将元素移动到正确位置
                container.appendChild(wrapper);

                // 为自己的终端添加全屏按钮
                if (terminal.ownerId === this.currentUser.userId) {
                    this.addFullscreenButton(wrapper, terminal.id);
                }
            }
        });
    }

    // 添加全屏按钮
    addFullscreenButton(wrapper, terminalId) {
        // 检查是否已经有全屏按钮
        if (wrapper.querySelector('.fullscreen-btn')) {
            return;
        }

        const header = wrapper.querySelector('.terminal-header');
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.className = 'fullscreen-btn';
        fullscreenBtn.innerHTML = '⛶';
        fullscreenBtn.title = '全屏显示';

        fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen(wrapper, terminalId);
        });

        header.appendChild(fullscreenBtn);
    }

    // 切换全屏
    toggleFullscreen(wrapper, terminalId) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) return;

        if (wrapper.classList.contains('fullscreen')) {
            // 退出全屏
            this.exitFullscreen(wrapper, terminalId);
        } else {
            // 进入全屏
            this.enterFullscreen(wrapper, terminalId);
        }
    }

    // 进入全屏
    enterFullscreen(wrapper, terminalId) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) return;

        wrapper.classList.add('fullscreen');
        document.body.classList.add('terminal-fullscreen');
        wrapper.querySelector('.fullscreen-btn').innerHTML = '✕';
        wrapper.querySelector('.fullscreen-btn').title = '退出全屏 (ESC或双击)';

        // 添加ESC键监听
        this.fullscreenKeyHandler = (e) => {
            if (e.key === 'Escape') {
                this.exitFullscreen(wrapper, terminalId);
            }
        };
        document.addEventListener('keydown', this.fullscreenKeyHandler);

        // 添加双击退出全屏
        this.fullscreenDblClickHandler = (e) => {
            if (e.target.closest('.terminal-content')) {
                this.exitFullscreen(wrapper, terminalId);
            }
        };
        wrapper.addEventListener('dblclick', this.fullscreenDblClickHandler);

        // 重新调整终端大小
        setTimeout(() => {
            terminal.fitAddon.fit();
        }, 100);
    }

    // 退出全屏
    exitFullscreen(wrapper, terminalId) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) return;

        wrapper.classList.remove('fullscreen');
        document.body.classList.remove('terminal-fullscreen');
        wrapper.querySelector('.fullscreen-btn').innerHTML = '⛶';
        wrapper.querySelector('.fullscreen-btn').title = '全屏显示';

        // 移除事件监听
        if (this.fullscreenKeyHandler) {
            document.removeEventListener('keydown', this.fullscreenKeyHandler);
            this.fullscreenKeyHandler = null;
        }
        if (this.fullscreenDblClickHandler) {
            wrapper.removeEventListener('dblclick', this.fullscreenDblClickHandler);
            this.fullscreenDblClickHandler = null;
        }

        // 重新调整终端大小
        setTimeout(() => {
            terminal.fitAddon.fit();
        }, 100);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new WebSSHClient();
});
