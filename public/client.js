class WebSSHClient {
    constructor() {
        this.socket = null;
        this.terminals = new Map(); // terminalId -> { xterm, fitAddon, isOwn }
        this.currentUser = null;
        this.users = [];
        this.terminalsList = [];

        this.initializeElements();
        this.bindEvents();
        this.loadSavedUsername();
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

        // 支持全局回车键登录（当在登录界面时）
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.loginContainer.style.display !== 'none') {
                // 如果用户名输入框有值或者焦点在加入按钮上，则登录
                if (this.usernameInput.value.trim() || document.activeElement === this.joinBtn) {
                    this.join();
                }
            }
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

        // 保存用户名到本地存储
        this.saveUsername(username);

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
            this.showSecurityAlert(alertData);
        });

        // 用户被封禁通知
        this.socket.on('user-blocked-notification', (blockData) => {
            this.showStatus(`🚫 ${blockData.message}`, 'error');
        });

        // 强制断开连接
        this.socket.on('force-disconnect', (disconnectData) => {
            this.showForceDisconnectDialog(disconnectData);
        });

        // IP被封禁
        this.socket.on('ip-banned', (banData) => {
            this.showIPBannedDialog(banData);
        });

        // IP强制断开连接
        this.socket.on('ip-force-disconnect', (disconnectData) => {
            this.showIPForceDisconnectDialog(disconnectData);
        });

        // IP封禁通知
        this.socket.on('ip-ban-notification', (banData) => {
            this.showStatus(`🚫 ${banData.message}`, 'error');
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
        // 不清空用户名，保持记忆功能
        this.joinBtn.disabled = false;
        this.joinBtn.textContent = '加入';
        this.terminalsContainer.innerHTML = '';

        this.currentUser = null;
        this.users = [];
        this.terminalsList = [];

        // 重新加载保存的用户名（不显示提示）
        this.loadSavedUsername(false);
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

    // 保存用户名到本地存储
    saveUsername(username) {
        try {
            localStorage.setItem('linuxdo_username', username);
        } catch (error) {
            console.warn('无法保存用户名到本地存储:', error);
        }
    }

    // 从本地存储加载用户名
    loadSavedUsername(showHint = true) {
        try {
            const savedUsername = localStorage.getItem('linuxdo_username');
            if (savedUsername) {
                this.usernameInput.value = savedUsername;
                this.usernameInput.placeholder = `上次使用: ${savedUsername}`;

                // 自动聚焦到加入按钮，方便直接回车登录
                this.joinBtn.focus();

                // 显示提示信息（仅在首次加载时）
                if (showHint) {
                    this.showUsernameHint(savedUsername);
                }
            }
        } catch (error) {
            console.warn('无法从本地存储加载用户名:', error);
        }
    }

    // 显示用户名提示
    showUsernameHint(username) {
        const hintElement = document.createElement('div');
        hintElement.className = 'username-hint';
        hintElement.innerHTML = `
            <span>💡 检测到上次使用的用户名: <strong>${username}</strong></span>
            <button class="clear-username-btn" title="清除记忆的用户名">✕</button>
        `;

        // 插入到输入框下方
        const inputGroup = document.querySelector('.input-group');
        inputGroup.parentNode.insertBefore(hintElement, inputGroup.nextSibling);

        // 绑定清除按钮事件
        const clearBtn = hintElement.querySelector('.clear-username-btn');
        clearBtn.addEventListener('click', () => {
            this.clearSavedUsername();
            hintElement.remove();
        });

        // 5秒后自动隐藏提示
        setTimeout(() => {
            if (document.body.contains(hintElement)) {
                hintElement.style.opacity = '0';
                setTimeout(() => {
                    if (document.body.contains(hintElement)) {
                        hintElement.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    // 清除保存的用户名
    clearSavedUsername() {
        try {
            localStorage.removeItem('linuxdo_username');
            this.usernameInput.value = '';
            this.usernameInput.placeholder = '输入用户名';
            this.usernameInput.focus();
            this.showStatus('已清除记忆的用户名', 'info');
        } catch (error) {
            console.warn('无法清除保存的用户名:', error);
        }
    }

    // 显示安全警告
    showSecurityAlert(alertData) {
        // 根据严重程度选择不同的样式
        let alertClass = 'security-alert';
        let icon = '🚨';

        switch (alertData.severity) {
            case 'critical':
                alertClass += ' critical';
                icon = '🔥';
                break;
            case 'high':
                alertClass += ' high';
                icon = '⚠️';
                break;
            case 'medium':
                alertClass += ' medium';
                icon = '⚡';
                break;
            default:
                alertClass += ' warning';
                icon = '🚨';
        }

        // 创建安全警告弹窗
        const alertDiv = document.createElement('div');
        alertDiv.className = alertClass;
        alertDiv.innerHTML = `
            <div class="alert-content">
                <div class="alert-header">
                    <span class="alert-icon">${icon}</span>
                    <span class="alert-title">安全警告</span>
                    <span class="alert-severity">[${alertData.severity?.toUpperCase() || 'WARNING'}]</span>
                </div>
                <div class="alert-message">${alertData.message}</div>
                ${alertData.command ? `<div class="alert-command">命令: <code>${alertData.command}</code></div>` : ''}
                <div class="alert-time">${new Date(alertData.timestamp).toLocaleString()}</div>
                <button class="alert-close">×</button>
            </div>
        `;

        document.body.appendChild(alertDiv);

        // 绑定关闭事件
        const closeBtn = alertDiv.querySelector('.alert-close');
        closeBtn.addEventListener('click', () => {
            alertDiv.remove();
        });

        // 自动关闭（根据严重程度调整时间）
        const autoCloseTime = alertData.severity === 'critical' ? 10000 :
                             alertData.severity === 'high' ? 8000 : 5000;

        setTimeout(() => {
            if (document.body.contains(alertDiv)) {
                alertDiv.style.opacity = '0';
                setTimeout(() => {
                    if (document.body.contains(alertDiv)) {
                        alertDiv.remove();
                    }
                }, 300);
            }
        }, autoCloseTime);

        // 同时显示状态消息
        this.showStatus(`${icon} ${alertData.message}`, 'warning');
    }

    // 显示强制断开连接对话框
    showForceDisconnectDialog(disconnectData) {
        // 创建模态对话框
        const modal = document.createElement('div');
        modal.className = 'disconnect-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <span class="modal-icon">🚫</span>
                    <h3>连接已被终止</h3>
                </div>
                <div class="modal-body">
                    <p><strong>原因：</strong>${disconnectData.reason}</p>
                    ${disconnectData.details ? `<p><strong>详情：</strong>${disconnectData.details}</p>` : ''}
                    <p>您的连接已被系统自动断开，请检查您的操作是否符合使用规范。</p>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn primary" onclick="location.reload()">重新连接</button>
                    <button class="modal-btn secondary" onclick="window.close()">关闭页面</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 5秒后自动重新加载页面
        setTimeout(() => {
            location.reload();
        }, 5000);
    }

    // 显示IP被封禁对话框
    showIPBannedDialog(banData) {
        const modal = document.createElement('div');
        modal.className = 'disconnect-modal ip-banned';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <span class="modal-icon">🚫</span>
                    <h3>IP地址已被封禁</h3>
                </div>
                <div class="modal-body">
                    <p><strong>封禁原因：</strong>${banData.reason}</p>
                    <p><strong>封禁时间：</strong>${new Date(banData.bannedAt).toLocaleString()}</p>
                    ${banData.permanent ?
                        '<p><strong>封禁类型：</strong><span class="permanent-ban">永久封禁</span></p>' :
                        `<p><strong>封禁时长：</strong>${banData.duration}小时</p>`
                    }
                    <p class="warning-text">您的IP地址因违反使用规范已被系统封禁。</p>
                    ${banData.permanent ?
                        '<p class="contact-info">如需申诉，请联系管理员：zbiuwi@163.com</p>' :
                        '<p class="temp-info">临时封禁将在指定时间后自动解除。</p>'
                    }
                </div>
                <div class="modal-footer">
                    <button class="modal-btn secondary" onclick="window.close()">关闭页面</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // 显示IP强制断开连接对话框
    showIPForceDisconnectDialog(disconnectData) {
        const modal = document.createElement('div');
        modal.className = 'disconnect-modal ip-force-disconnect';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <span class="modal-icon">🔥</span>
                    <h3>连接已被强制终止</h3>
                </div>
                <div class="modal-body">
                    <p><strong>原因：</strong>${disconnectData.reason}</p>
                    <p><strong>详情：</strong>${disconnectData.details}</p>
                    ${disconnectData.permanent ?
                        '<p><strong>封禁类型：</strong><span class="permanent-ban">永久封禁</span></p>' :
                        '<p><strong>封禁类型：</strong>临时封禁</p>'
                    }
                    <p><strong>违规次数：</strong>${disconnectData.banCount}</p>
                    <p class="warning-text">您的IP地址因多次违规已被系统封禁，连接已被强制断开。</p>
                    ${disconnectData.permanent ?
                        '<p class="contact-info">如需申诉，请联系管理员：zbiuwi@163.com</p>' :
                        '<p class="temp-info">请等待封禁时间结束后再次尝试连接。</p>'
                    }
                </div>
                <div class="modal-footer">
                    <button class="modal-btn secondary" onclick="window.close()">关闭页面</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new WebSSHClient();
});
