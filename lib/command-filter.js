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
      'g++ -o /dev/null'
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
  }

  /**
   * 检查命令是否危险
   * @param {string} command - 要检查的命令
   * @returns {boolean} 是否为危险命令
   */
  isDangerous(command) {
    if (!command || typeof command !== 'string') {
      return false;
    }

    const normalizedCommand = command.toLowerCase().trim();

    // 检查正则表达式模式（优先级更高，更精确）
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(normalizedCommand)) {
        return true;
      }
    }

    // 检查精确匹配的危险命令（但排除一些特殊情况）
    for (const dangerousCmd of this.dangerousCommands) {
      if (dangerousCmd === 'rm -f' && this.isSafeRmCommand(normalizedCommand)) {
        continue; // 跳过安全的rm -f命令
      }
      if (normalizedCommand.includes(dangerousCmd.toLowerCase())) {
        return true;
      }
    }

    // 检查sudo危险命令
    if (normalizedCommand.startsWith('sudo ')) {
      const sudoCommand = normalizedCommand.substring(5);
      for (const dangerousCmd of this.sudoDangerousCommands) {
        if (sudoCommand.includes(dangerousCmd.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
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
    if (!this.isDangerous(command)) {
      return '';
    }

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
   * 获取所有危险命令列表
   * @returns {Array} 危险命令列表
   */
  getDangerousCommands() {
    return [...this.dangerousCommands];
  }
}

module.exports = CommandFilter;
