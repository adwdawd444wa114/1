class CommandFilter {
  constructor() {
    // 危险命令列表
    this.dangerousCommands = [
      // 删除命令
      'rm -rf',
      'rm -r',
      'rm -f',
      'rmdir',
      'del /s',
      'del /q',
      'rd /s',

      // 系统关机/重启
      'shutdown',
      'reboot',
      'halt',
      'poweroff',
      'init 0',
      'init 6',

      // 格式化磁盘
      'mkfs',
      'format',
      'fdisk',
      'parted',

      // 修改系统文件
      'chmod 777 /',
      'chown root /',
      'passwd root',

      // 网络攻击
      'dd if=/dev/zero',
      'dd if=/dev/random',
      'fork bomb',
      ':(){ :|:& };:',

      // 危险的系统命令
      'kill -9 1',
      'killall -9',
      'pkill -9',

      // 修改重要配置
      'echo > /etc/passwd',
      'echo > /etc/shadow',
      'echo > /etc/hosts',

      // 危险的下载执行
      'curl | sh',
      'wget | sh',
      'curl | bash',
      'wget | bash',

      // 修改PATH等环境变量
      'export PATH=',
      'unset PATH',

      // 危险的重定向
      '> /dev/sda',
      '> /dev/hda',
      '> /dev/nvme',

      // 系统服务操作
      'systemctl stop',
      'systemctl disable',
      'service stop',

      // 包管理器危险操作
      'apt-get remove --purge',
      'yum remove',
      'dnf remove',
      'pacman -R',

      // 编译器炸弹
      'gcc -o /dev/null',
      'g++ -o /dev/null',

      // 新增：更多危险命令
      'mount',
      'umount',
      'swapon',
      'swapoff',
      'crontab -r',
      'iptables -F',
      'ufw --force reset',
      'firewall-cmd --reload',
      'setenforce 0',
      'echo 0 > /proc/sys/kernel/randomize_va_space',
      'sysctl -w',
      'modprobe',
      'rmmod',
      'insmod',
      'depmod',
      'ldconfig',
      'update-grub',
      'grub-install',
      'lilo',
      'bootctl',
      'efibootmgr',
      'cryptsetup',
      'losetup',
      'dmsetup',
      'mdadm',
      'lvm',
      'pvremove',
      'vgremove',
      'lvremove',
      'wipefs',
      'shred',
      'srm',
      'wipe',
      'dban',
      'nuke',
      'zerofree',
      'badblocks',
      'e2fsck -y',
      'fsck -y',
      'tune2fs',
      'resize2fs',
      'xfs_repair',
      'btrfs',
      'zfs',
      'zpool',
      'snap remove',
      'flatpak uninstall',
      'docker system prune',
      'docker rmi',
      'podman rmi',
      'systemctl mask',
      'systemctl isolate',
      'telinit',
      'runlevel',
      'who -r',
      'last reboot',
      'uptime',
      'dmesg -c',
      'journalctl --vacuum',
      'logrotate -f',
      'truncate -s 0',
      'fallocate',
      'setfacl',
      'setcap',
      'chattr',
      'lsattr',
      'chcon',
      'restorecon',
      'setsebool',
      'getsebool',
      'semanage',
      'ausearch',
      'aureport',
      'auditctl',
      'usermod',
      'userdel',
      'groupdel',
      'deluser',
      'delgroup',
      'passwd -d',
      'passwd -l',
      'chage',
      'faillog',
      'lastlog',
      'chfn',
      'chsh',
      'newgrp',
      'sg',
      'su -',
      'sudo su',
      'sudo -i',
      'sudo -s',
      'pkexec',
      'gksu',
      'kdesu',
      'runuser',
      'machinectl',
      'systemd-nspawn',
      'chroot',
      'unshare',
      'nsenter',
      'setns',
      'pivot_root',
      'switch_root'
    ];

    // 危险命令模式（正则表达式）
    this.dangerousPatterns = [
      // rm 命令的各种危险变体
      /rm\s+(-[rf]+\s+)?\//,  // rm 删除根目录
      /rm\s+(-[rf]+\s+)?\/\*/,  // rm 删除根目录下所有文件
      /rm\s+(-[rf]+\s+)?~\//,   // rm 删除用户目录
      /rm\s+(-[rf]+\s+)?\$HOME/,  // rm 删除HOME目录
      /rm\s+-[rf]*r[rf]*\s+\//,  // rm -r 删除根目录（更精确匹配）
      /rm\s+-[rf]*f[rf]*\s+\//,  // rm -f 删除根目录
      /rm\s+--recursive\s+\//,   // rm --recursive /
      /rm\s+--force\s+\//,       // rm --force /
      /rm\s+-rf\s*\*/,           // rm -rf *
      /rm\s+-fr\s*\*/,           // rm -fr *
      /rm\s+-r\s+-f\s*\*/,       // rm -r -f *
      /rm\s+-f\s+-r\s*\*/,       // rm -f -r *
      /rm\s+(-[a-z]*[rf][a-z]*\s+)+\//,  // 各种参数组合删除根目录
      /rm\s+(-[a-z]*[rf][a-z]*\s+)+\*/,  // 各种参数组合删除所有文件
      /rm\s+(-[a-z]*[rf][a-z]*\s+)+~\//,  // 各种参数组合删除用户目录

      // 其他危险命令
      /dd\s+if=\/dev\/(zero|random|urandom)\s+of=/,  // dd 写入设备
      />\s*\/dev\/(sd[a-z]|hd[a-z]|nvme[0-9])/,  // 重定向到磁盘设备
      /chmod\s+777\s+\//,  // 修改根目录权限
      /chown\s+.*\s+\//,   // 修改根目录所有者
      /:\(\)\{\s*:\|\:&\s*\}\;\:/,  // fork bomb
      /while\s+true.*do.*done/,  // 无限循环
      /for\s*\(\(\s*;\s*;\s*\)\)/,  // 无限循环
      /curl.*\|\s*(sh|bash)/,  // 危险的管道执行
      /wget.*\|\s*(sh|bash)/,  // 危险的管道执行
      /echo.*>\s*\/etc\/(passwd|shadow|hosts|fstab)/,  // 修改系统文件
      /mv\s+\/etc\/(passwd|shadow|hosts)/,  // 移动系统文件
      /cp\s+.*\s+\/etc\/(passwd|shadow|hosts)/,  // 复制到系统文件
      /kill\s+-9\s+1/,  // 杀死init进程
      /pkill\s+-9\s+/,  // 强制杀死进程
      /killall\s+-9/,   // 强制杀死所有进程

      // sudo 危险命令
      /sudo\s+rm\s+(-[a-z]*[rf][a-z]*\s+)+/,  // sudo rm 各种删除参数
      /sudo\s+dd/,      // sudo dd
      /sudo\s+mkfs/,    // sudo格式化
      /sudo\s+fdisk/,   // sudo分区
      /sudo\s+shutdown/, // sudo关机
      /sudo\s+reboot/,  // sudo重启
      /sudo\s+halt/,    // sudo停机
      /sudo\s+poweroff/, // sudo断电

      // 更多rm变体检测
      /\brm\b.*-.*r.*\s+\/[^a-zA-Z0-9]/,  // rm 带r参数删除根目录相关
      /\brm\b.*-.*f.*\s+\/[^a-zA-Z0-9]/,  // rm 带f参数删除根目录相关
      /\brm\b.*\s+\/\s*$/,                // rm 删除根目录（行尾）
      /\brm\b.*\s+\/\*\s*$/,              // rm 删除根目录所有文件（行尾）

      // 新增：绕过技巧检测
      // 编码绕过检测
      /echo\s+[A-Za-z0-9+\/=]+\s*\|\s*base64\s+-d\s*\|\s*(sh|bash)/,  // base64编码执行
      /printf\s+.*\|\s*(sh|bash)/,  // printf执行
      /\$\(echo\s+.*\)/,  // 命令替换
      /\`echo\s+.*\`/,    // 反引号命令替换
      /\$\{.*\}/,         // 变量替换可能的危险用法

      // 间接执行检测
      /\|\s*sh\s*$/,      // 管道到shell
      /\|\s*bash\s*$/,    // 管道到bash
      /\|\s*zsh\s*$/,     // 管道到zsh
      /\|\s*fish\s*$/,    // 管道到fish
      /\|\s*csh\s*$/,     // 管道到csh
      /\|\s*tcsh\s*$/,    // 管道到tcsh
      /\|\s*ksh\s*$/,     // 管道到ksh

      // 文件写入后执行
      />\s*\/tmp\/.*\.sh/,  // 写入临时脚本
      />\s*\/var\/tmp\/.*\.sh/,  // 写入临时脚本
      />\s*\/dev\/shm\/.*\.sh/,  // 写入共享内存脚本
      /chmod\s+\+x\s+.*\.sh/,   // 给脚本添加执行权限

      // 网络下载执行
      /curl\s+.*\s*\|\s*sudo/,  // curl管道到sudo
      /wget\s+.*\s*\|\s*sudo/,  // wget管道到sudo
      /fetch\s+.*\s*\|\s*(sh|bash)/,  // fetch执行

      // 进程替换
      /<\(.*\)/,          // 进程替换
      />\(.*\)/,          // 进程替换

      // 危险的重定向和管道组合
      /.*\|\s*tee\s+\/etc\//,  // tee写入系统目录
      /.*\|\s*dd\s+of=/,       // 管道到dd
      /.*>\s*\/proc\//,        // 写入proc文件系统
      /.*>\s*\/sys\//,         // 写入sys文件系统

      // 时间炸弹和定时任务
      /at\s+now\s*\+/,         // at定时任务
      /echo\s+.*\|\s*at\s+/,   // echo到at
      /crontab\s*<<</,         // heredoc到crontab

      // 内存和系统资源攻击
      /\/dev\/zero\s*>\s*/,    // 从zero设备重定向
      /yes\s+.*\s*\|/,         // yes命令可能的DoS
      /cat\s+\/dev\/urandom/,  // 读取随机数据

      // 权限提升尝试
      /sudo\s+-u\s+root/,      // sudo切换到root
      /su\s+-\s+root/,         // su到root
      /sudo\s+-s/,             // sudo shell
      /sudo\s+-i/,             // sudo login shell

      // 系统信息泄露
      /cat\s+\/etc\/shadow/,   // 读取shadow文件
      /cat\s+\/etc\/passwd/,   // 读取passwd文件
      /cat\s+\/proc\/.*\/environ/,  // 读取进程环境变量

      // 网络攻击
      /nc\s+.*\s+-e/,          // netcat执行
      /ncat\s+.*\s+-e/,        // ncat执行
      /socat\s+.*exec/,        // socat执行

      // 容器逃逸
      /docker\s+run.*--privileged/,  // 特权容器
      /docker\s+exec.*-it.*root/,    // 容器内root执行
      /kubectl\s+exec/,              // k8s执行

      // 更多变体和混淆
      /r''m\s+/,              // 引号混淆rm
      /r""m\s+/,              // 引号混淆rm
      /\$\{rm\}/,             // 变量形式rm
      /\$(which\s+rm)/,       // which命令获取rm路径
      /\/bin\/rm/,            // 绝对路径rm
      /\/usr\/bin\/rm/,       // 绝对路径rm

      // 特殊字符绕过
      /rm\s+\.\.\//,          // rm ../
      /rm\s+\.\//,            // rm ./
      /rm\s+\~\//,            // rm ~/

      // 通配符危险用法
      /rm\s+.*\*.*\*/,        // 多个通配符
      /rm\s+.*\?\?\?/,        // 问号通配符
      /rm\s+.*\[.*\]/,        // 方括号通配符
    ];

    // 需要sudo的危险命令
    this.sudoDangerousCommands = [
      'rm -rf /',
      'dd if=/dev/zero of=/dev/sda',
      'mkfs.ext4 /dev/sda',
      'fdisk /dev/sda',
      'shutdown -h now',
      'reboot',
      'halt',
      'poweroff'
    ];

    // 安全命令白名单（基础命令）
    this.safeCommands = [
      'ls', 'dir', 'pwd', 'cd', 'echo', 'cat', 'less', 'more', 'head', 'tail',
      'grep', 'find', 'locate', 'which', 'whereis', 'whoami', 'id', 'groups',
      'date', 'cal', 'uptime', 'w', 'who', 'finger', 'last', 'history',
      'ps', 'top', 'htop', 'jobs', 'pstree', 'lsof', 'netstat', 'ss',
      'df', 'du', 'free', 'lscpu', 'lsmem', 'lsblk', 'lsusb', 'lspci',
      'uname', 'hostname', 'dmesg', 'lsmod', 'env', 'printenv', 'set',
      'alias', 'unalias', 'type', 'help', 'man', 'info', 'apropos',
      'wc', 'sort', 'uniq', 'cut', 'tr', 'sed', 'awk', 'tee',
      'touch', 'mkdir', 'cp', 'mv', 'ln', 'stat', 'file', 'basename', 'dirname',
      'tar', 'gzip', 'gunzip', 'zip', 'unzip', 'compress', 'uncompress',
      'wget', 'curl', 'ping', 'traceroute', 'nslookup', 'dig', 'host',
      'ssh', 'scp', 'rsync', 'ftp', 'sftp', 'telnet',
      'vim', 'vi', 'nano', 'emacs', 'gedit', 'code',
      'git', 'svn', 'hg', 'bzr',
      'python', 'python3', 'node', 'npm', 'pip', 'pip3',
      'gcc', 'g++', 'make', 'cmake', 'javac', 'java',
      'clear', 'reset', 'tput', 'stty', 'tty', 'screen', 'tmux',
      'sleep', 'wait', 'timeout', 'watch', 'yes', 'true', 'false',
      'test', 'expr', 'bc', 'dc', 'factor', 'seq', 'shuf', 'random'
    ];

    // 命令历史记录（用于检测序列攻击）
    this.commandHistory = [];
    this.maxHistorySize = 10;

    // 速率限制配置
    this.rateLimitConfig = {
      maxCommandsPerMinute: 60,
      maxDangerousAttemptsPerMinute: 3,
      blockDurationMinutes: 5
    };

    // 用户速率限制状态
    this.userRateLimits = new Map();
  }

  /**
   * 检查命令是否危险
   * @param {string} command - 要检查的命令
   * @param {string} userId - 用户ID（用于速率限制）
   * @returns {Object} 检查结果 {isDangerous: boolean, reason: string, severity: string}
   */
  isDangerous(command, userId = null) {
    if (!command || typeof command !== 'string') {
      return { isDangerous: false, reason: '', severity: 'none' };
    }

    const normalizedCommand = command.toLowerCase().trim();

    // 检查速率限制
    if (userId) {
      const rateLimitResult = this.checkRateLimit(userId, normalizedCommand);
      if (rateLimitResult.blocked) {
        return {
          isDangerous: true,
          reason: rateLimitResult.reason,
          severity: 'critical'
        };
      }
    }

    // 检查命令长度（防止超长命令攻击）
    if (command.length > 1000) {
      return {
        isDangerous: true,
        reason: '命令长度超过限制，可能是攻击尝试',
        severity: 'high'
      };
    }

    // 检查是否包含null字节（可能的注入攻击）
    if (command.includes('\0') || command.includes('\x00')) {
      return {
        isDangerous: true,
        reason: '命令包含null字节，可能是注入攻击',
        severity: 'critical'
      };
    }

    // 检查是否包含过多的特殊字符（可能的混淆攻击）
    const specialCharCount = (command.match(/[;&|`$(){}[\]<>]/g) || []).length;
    if (specialCharCount > 10) {
      return {
        isDangerous: true,
        reason: '命令包含过多特殊字符，可能是混淆攻击',
        severity: 'medium'
      };
    }

    // 检查正则表达式模式（优先级更高，更精确）
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(normalizedCommand)) {
        return {
          isDangerous: true,
          reason: this.getDangerReason(command),
          severity: 'high'
        };
      }
    }

    // 检查精确匹配的危险命令（但排除一些特殊情况）
    for (const dangerousCmd of this.dangerousCommands) {
      if (dangerousCmd === 'rm -f' && this.isSafeRmCommand(normalizedCommand)) {
        continue; // 跳过安全的rm -f命令
      }
      if (normalizedCommand.includes(dangerousCmd.toLowerCase())) {
        return {
          isDangerous: true,
          reason: this.getDangerReason(command),
          severity: 'high'
        };
      }
    }

    // 检查sudo危险命令
    if (normalizedCommand.startsWith('sudo ')) {
      const sudoCommand = normalizedCommand.substring(5);
      for (const dangerousCmd of this.sudoDangerousCommands) {
        if (sudoCommand.includes(dangerousCmd.toLowerCase())) {
          return {
            isDangerous: true,
            reason: this.getDangerReason(command),
            severity: 'critical'
          };
        }
      }
    }

    // 检查命令序列攻击
    const sequenceResult = this.checkCommandSequence(normalizedCommand);
    if (sequenceResult.isDangerous) {
      return sequenceResult;
    }

    // 检查编码绕过
    const encodingResult = this.checkEncodingBypass(normalizedCommand);
    if (encodingResult.isDangerous) {
      return encodingResult;
    }

    // 记录命令到历史（用于序列检测）
    this.addToHistory(normalizedCommand);

    return { isDangerous: false, reason: '', severity: 'none' };
  }

  /**
   * 检查是否是安全的rm命令
   * @param {string} command - 命令
   * @returns {boolean} 是否安全
   */
  isSafeRmCommand(command) {
    // 如果rm命令不涉及根目录、用户目录等关键路径，则认为是安全的
    const safeRmPattern = /^rm\s+(-[a-z]*f[a-z]*\s+)?[^\/~\$][^\s]*(\s+[^\/~\$][^\s]*)*$/;
    return safeRmPattern.test(command);
  }

  /**
   * 获取命令危险性说明
   * @param {string} command - 命令
   * @returns {string} 危险性说明
   */
  getDangerReason(command) {
    const normalizedCommand = command.toLowerCase().trim();

    if (normalizedCommand.includes('rm -rf') || normalizedCommand.includes('rm -r')) {
      return '此命令可能会删除重要文件或目录';
    }

    if (normalizedCommand.includes('shutdown') || normalizedCommand.includes('reboot')) {
      return '此命令会关闭或重启系统';
    }

    if (normalizedCommand.includes('dd if=/dev/zero') || normalizedCommand.includes('dd if=/dev/random')) {
      return '此命令可能会破坏磁盘数据';
    }

    if (normalizedCommand.includes('chmod 777 /') || normalizedCommand.includes('chown')) {
      return '此命令会修改重要系统文件权限';
    }

    if (normalizedCommand.includes('kill -9 1') || normalizedCommand.includes('killall -9')) {
      return '此命令会强制终止重要系统进程';
    }

    if (normalizedCommand.includes('mkfs') || normalizedCommand.includes('format')) {
      return '此命令会格式化磁盘，导致数据丢失';
    }

    if (normalizedCommand.includes('base64') && normalizedCommand.includes('|')) {
      return '检测到可能的编码绕过攻击';
    }

    if (normalizedCommand.includes('sudo')) {
      return '检测到权限提升尝试';
    }

    if (normalizedCommand.includes('mount') || normalizedCommand.includes('umount')) {
      return '此命令会修改文件系统挂载';
    }

    return '此命令被识别为危险命令';
  }

  /**
   * 添加自定义危险命令
   * @param {string} command - 要添加的危险命令
   */
  addDangerousCommand(command) {
    if (command && !this.dangerousCommands.includes(command)) {
      this.dangerousCommands.push(command);
    }
  }

  /**
   * 添加自定义危险模式
   * @param {RegExp} pattern - 要添加的危险模式
   */
  addDangerousPattern(pattern) {
    if (pattern instanceof RegExp && !this.dangerousPatterns.includes(pattern)) {
      this.dangerousPatterns.push(pattern);
    }
  }

  /**
   * 检查速率限制
   * @param {string} userId - 用户ID
   * @param {string} command - 命令
   * @returns {Object} 速率限制结果
   */
  checkRateLimit(userId, command) {
    const now = Date.now();
    const oneMinute = 60 * 1000;

    if (!this.userRateLimits.has(userId)) {
      this.userRateLimits.set(userId, {
        commands: [],
        dangerousAttempts: [],
        blockedUntil: 0
      });
    }

    const userLimit = this.userRateLimits.get(userId);

    // 检查是否仍在封禁期
    if (userLimit.blockedUntil > now) {
      const remainingTime = Math.ceil((userLimit.blockedUntil - now) / 1000);
      return {
        blocked: true,
        reason: `用户被临时封禁，剩余时间: ${remainingTime}秒`
      };
    }

    // 清理过期的记录
    userLimit.commands = userLimit.commands.filter(time => now - time < oneMinute);
    userLimit.dangerousAttempts = userLimit.dangerousAttempts.filter(time => now - time < oneMinute);

    // 检查命令频率
    if (userLimit.commands.length >= this.rateLimitConfig.maxCommandsPerMinute) {
      userLimit.blockedUntil = now + (this.rateLimitConfig.blockDurationMinutes * 60 * 1000);
      return {
        blocked: true,
        reason: '命令执行频率过高，已被临时封禁'
      };
    }

    // 记录当前命令
    userLimit.commands.push(now);

    // 如果是危险命令尝试，记录并检查
    const isDangerousAttempt = this.dangerousCommands.some(cmd =>
      command.includes(cmd.toLowerCase())
    ) || this.dangerousPatterns.some(pattern => pattern.test(command));

    if (isDangerousAttempt) {
      userLimit.dangerousAttempts.push(now);

      if (userLimit.dangerousAttempts.length >= this.rateLimitConfig.maxDangerousAttemptsPerMinute) {
        userLimit.blockedUntil = now + (this.rateLimitConfig.blockDurationMinutes * 60 * 1000);
        return {
          blocked: true,
          reason: '危险命令尝试次数过多，已被临时封禁'
        };
      }
    }

    return { blocked: false };
  }

  /**
   * 检查命令序列攻击
   * @param {string} command - 命令
   * @returns {Object} 检查结果
   */
  checkCommandSequence(command) {
    // 检查是否是多命令组合（可能的攻击序列）
    const commandSeparators = [';', '&&', '||', '|', '&'];
    const hasMultipleCommands = commandSeparators.some(sep => command.includes(sep));

    if (hasMultipleCommands) {
      // 分割命令并检查每个部分
      const parts = command.split(/[;&|]+/).map(part => part.trim());

      for (const part of parts) {
        if (this.dangerousCommands.some(cmd => part.includes(cmd.toLowerCase()))) {
          return {
            isDangerous: true,
            reason: '检测到危险的命令序列组合',
            severity: 'high'
          };
        }
      }

      // 检查是否有可疑的命令组合模式
      const suspiciousPatterns = [
        /echo.*>.*\.sh.*chmod.*\+x/,  // 创建并执行脚本
        /wget.*chmod.*\+x/,           // 下载并执行
        /curl.*chmod.*\+x/,           // 下载并执行
        /mkdir.*cd.*rm/,              // 创建目录后删除
        /touch.*echo.*>/,             // 创建文件后写入
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(command)) {
          return {
            isDangerous: true,
            reason: '检测到可疑的命令组合模式',
            severity: 'medium'
          };
        }
      }
    }

    return { isDangerous: false };
  }

  /**
   * 检查编码绕过攻击
   * @param {string} command - 命令
   * @returns {Object} 检查结果
   */
  checkEncodingBypass(command) {
    // 检查base64编码
    const base64Pattern = /[A-Za-z0-9+\/=]{20,}/;
    if (base64Pattern.test(command) && command.includes('base64')) {
      try {
        const decoded = Buffer.from(command.match(base64Pattern)[0], 'base64').toString();
        if (this.dangerousCommands.some(cmd => decoded.toLowerCase().includes(cmd.toLowerCase()))) {
          return {
            isDangerous: true,
            reason: '检测到base64编码的危险命令',
            severity: 'high'
          };
        }
      } catch (e) {
        // 忽略解码错误
      }
    }

    // 检查十六进制编码
    const hexPattern = /\\x[0-9a-fA-F]{2}/g;
    if (hexPattern.test(command)) {
      try {
        const decoded = command.replace(hexPattern, (match) =>
          String.fromCharCode(parseInt(match.slice(2), 16))
        );
        if (this.dangerousCommands.some(cmd => decoded.toLowerCase().includes(cmd.toLowerCase()))) {
          return {
            isDangerous: true,
            reason: '检测到十六进制编码的危险命令',
            severity: 'high'
          };
        }
      } catch (e) {
        // 忽略解码错误
      }
    }

    // 检查Unicode编码
    const unicodePattern = /\\u[0-9a-fA-F]{4}/g;
    if (unicodePattern.test(command)) {
      try {
        const decoded = command.replace(unicodePattern, (match) =>
          String.fromCharCode(parseInt(match.slice(2), 16))
        );
        if (this.dangerousCommands.some(cmd => decoded.toLowerCase().includes(cmd.toLowerCase()))) {
          return {
            isDangerous: true,
            reason: '检测到Unicode编码的危险命令',
            severity: 'high'
          };
        }
      } catch (e) {
        // 忽略解码错误
      }
    }

    return { isDangerous: false };
  }

  /**
   * 添加命令到历史记录
   * @param {string} command - 命令
   */
  addToHistory(command) {
    this.commandHistory.push({
      command: command,
      timestamp: Date.now()
    });

    // 保持历史记录大小限制
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory.shift();
    }
  }

  /**
   * 获取所有危险命令列表
   * @returns {Array} 危险命令列表
   */
  getDangerousCommands() {
    return [...this.dangerousCommands];
  }

  /**
   * 清理用户速率限制记录
   * @param {string} userId - 用户ID
   */
  clearUserRateLimit(userId) {
    this.userRateLimits.delete(userId);
  }

  /**
   * 获取用户速率限制状态
   * @param {string} userId - 用户ID
   * @returns {Object} 速率限制状态
   */
  getUserRateLimitStatus(userId) {
    const userLimit = this.userRateLimits.get(userId);
    if (!userLimit) {
      return { blocked: false, commandCount: 0, dangerousAttempts: 0 };
    }

    const now = Date.now();
    const oneMinute = 60 * 1000;

    // 清理过期记录
    userLimit.commands = userLimit.commands.filter(time => now - time < oneMinute);
    userLimit.dangerousAttempts = userLimit.dangerousAttempts.filter(time => now - time < oneMinute);

    return {
      blocked: userLimit.blockedUntil > now,
      commandCount: userLimit.commands.length,
      dangerousAttempts: userLimit.dangerousAttempts.length,
      blockedUntil: userLimit.blockedUntil
    };
  }
}

module.exports = CommandFilter;
