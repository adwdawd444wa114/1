#!/usr/bin/env node

/**
 * 管理员工具
 * 用于管理IP封禁、查看安全统计等
 */

const IPBanManager = require('./lib/ip-ban-manager');
const SecurityMonitor = require('./lib/security-monitor');
const readline = require('readline');

class AdminTools {
  constructor() {
    this.ipBanManager = new IPBanManager();
    this.securityMonitor = new SecurityMonitor();
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * 显示主菜单
   */
  showMainMenu() {
    console.log('\n🔧 WebSSH 管理员工具');
    console.log('========================');
    console.log('1. 查看IP封禁统计');
    console.log('2. 查看被封禁的IP列表');
    console.log('3. 手动封禁IP');
    console.log('4. 解封IP');
    console.log('5. 添加IP到白名单');
    console.log('6. 查看安全统计');
    console.log('7. 查看IP详细信息');
    console.log('8. 清理过期数据');
    console.log('0. 退出');
    console.log('========================');
    
    this.rl.question('请选择操作 (0-8): ', (choice) => {
      this.handleMenuChoice(choice.trim());
    });
  }

  /**
   * 处理菜单选择
   */
  handleMenuChoice(choice) {
    switch (choice) {
      case '1':
        this.showBanStats();
        break;
      case '2':
        this.showBannedIPs();
        break;
      case '3':
        this.manualBanIP();
        break;
      case '4':
        this.unbanIP();
        break;
      case '5':
        this.addToWhitelist();
        break;
      case '6':
        this.showSecurityStats();
        break;
      case '7':
        this.showIPDetails();
        break;
      case '8':
        this.cleanupExpiredData();
        break;
      case '0':
        console.log('👋 再见！');
        this.rl.close();
        process.exit(0);
        break;
      default:
        console.log('❌ 无效选择，请重试');
        this.showMainMenu();
    }
  }

  /**
   * 显示封禁统计
   */
  showBanStats() {
    const stats = this.ipBanManager.getBanStats();
    
    console.log('\n📊 IP封禁统计');
    console.log('================');
    console.log(`总封禁IP数: ${stats.totalBannedIPs}`);
    console.log(`活跃封禁数: ${stats.activeBans}`);
    console.log(`永久封禁数: ${stats.permanentBans}`);
    console.log(`最近24小时封禁: ${stats.recentBans}`);
    console.log(`白名单IP数: ${stats.whitelistedIPs}`);
    console.log(`违规IP总数: ${stats.totalViolatingIPs}`);
    
    this.showMainMenu();
  }

  /**
   * 显示被封禁的IP列表
   */
  showBannedIPs() {
    const bannedIPs = Array.from(this.ipBanManager.bannedIPs.entries());
    
    console.log('\n🚫 被封禁的IP列表');
    console.log('==================');
    
    if (bannedIPs.length === 0) {
      console.log('暂无被封禁的IP');
    } else {
      bannedIPs.forEach(([ip, banInfo], index) => {
        const bannedTime = new Date(banInfo.bannedAt).toLocaleString();
        const status = banInfo.permanent ? '永久' : `${banInfo.duration}小时`;
        
        console.log(`${index + 1}. ${ip}`);
        console.log(`   封禁时间: ${bannedTime}`);
        console.log(`   封禁类型: ${status}`);
        console.log(`   封禁原因: ${banInfo.reason}`);
        console.log(`   封禁次数: ${banInfo.banCount}`);
        console.log('');
      });
    }
    
    this.showMainMenu();
  }

  /**
   * 手动封禁IP
   */
  manualBanIP() {
    this.rl.question('\n请输入要封禁的IP地址: ', (ip) => {
      if (!ip.trim()) {
        console.log('❌ IP地址不能为空');
        this.showMainMenu();
        return;
      }

      this.rl.question('请输入封禁原因: ', (reason) => {
        if (!reason.trim()) {
          reason = '管理员手动封禁';
        }

        this.rl.question('是否永久封禁? (y/N): ', (permanent) => {
          const isPermanent = permanent.toLowerCase() === 'y';
          
          const success = this.ipBanManager.banIP(ip.trim(), reason.trim(), isPermanent);
          
          if (success) {
            console.log(`✅ IP ${ip} 已被封禁`);
          } else {
            console.log(`❌ 封禁失败，IP可能在白名单中`);
          }
          
          this.showMainMenu();
        });
      });
    });
  }

  /**
   * 解封IP
   */
  unbanIP() {
    this.rl.question('\n请输入要解封的IP地址: ', (ip) => {
      if (!ip.trim()) {
        console.log('❌ IP地址不能为空');
        this.showMainMenu();
        return;
      }

      const success = this.ipBanManager.unbanIP(ip.trim());
      
      if (success) {
        console.log(`✅ IP ${ip} 已解封`);
      } else {
        console.log(`❌ 解封失败，IP可能未被封禁`);
      }
      
      this.showMainMenu();
    });
  }

  /**
   * 添加IP到白名单
   */
  addToWhitelist() {
    this.rl.question('\n请输入要添加到白名单的IP地址: ', (ip) => {
      if (!ip.trim()) {
        console.log('❌ IP地址不能为空');
        this.showMainMenu();
        return;
      }

      this.ipBanManager.addToWhitelist(ip.trim());
      console.log(`✅ IP ${ip} 已添加到白名单`);
      
      this.showMainMenu();
    });
  }

  /**
   * 显示安全统计
   */
  showSecurityStats() {
    const stats = this.securityMonitor.getSecurityStats();
    
    console.log('\n🔒 安全统计');
    console.log('============');
    console.log(`总安全事件: ${stats.totalEvents}`);
    console.log(`最近1小时事件: ${stats.recentEvents}`);
    console.log(`最近24小时事件: ${stats.dailyEvents}`);
    console.log(`被封禁用户: ${stats.blockedUsers}`);
    console.log(`高风险用户: ${stats.highRiskUsers}`);
    
    this.showMainMenu();
  }

  /**
   * 显示IP详细信息
   */
  showIPDetails() {
    this.rl.question('\n请输入要查询的IP地址: ', (ip) => {
      if (!ip.trim()) {
        console.log('❌ IP地址不能为空');
        this.showMainMenu();
        return;
      }

      const stats = this.ipBanManager.getIPStats(ip.trim());
      
      console.log(`\n📋 IP详细信息: ${ip}`);
      console.log('====================');
      console.log(`违规次数: ${stats.violations}`);
      console.log(`封禁次数: ${stats.banCount}`);
      console.log(`最后封禁: ${stats.lastBan ? new Date(stats.lastBan).toLocaleString() : '从未封禁'}`);
      console.log(`当前状态: ${stats.currentlyBanned ? '已封禁' : '正常'}`);
      console.log(`白名单状态: ${stats.whitelisted ? '在白名单中' : '不在白名单中'}`);
      
      if (stats.banInfo) {
        console.log('\n当前封禁信息:');
        console.log(`- 封禁时间: ${new Date(stats.banInfo.bannedAt).toLocaleString()}`);
        console.log(`- 封禁原因: ${stats.banInfo.reason}`);
        console.log(`- 封禁类型: ${stats.banInfo.permanent ? '永久' : `${stats.banInfo.duration}小时`}`);
      }
      
      this.showMainMenu();
    });
  }

  /**
   * 清理过期数据
   */
  cleanupExpiredData() {
    console.log('\n🧹 正在清理过期数据...');
    
    this.ipBanManager.cleanupExpiredData();
    this.securityMonitor.cleanupExpiredThreatScores();
    
    console.log('✅ 过期数据清理完成');
    this.showMainMenu();
  }

  /**
   * 启动管理工具
   */
  start() {
    console.log('🔧 WebSSH 管理员工具启动中...');
    console.log('正在加载数据...');
    
    // 等待数据加载完成
    setTimeout(() => {
      this.showMainMenu();
    }, 1000);
  }
}

// 启动管理工具
if (require.main === module) {
  const adminTools = new AdminTools();
  adminTools.start();
  
  // 处理退出信号
  process.on('SIGINT', () => {
    console.log('\n👋 管理工具已退出');
    process.exit(0);
  });
}

module.exports = AdminTools;
