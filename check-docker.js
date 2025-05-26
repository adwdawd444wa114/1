#!/usr/bin/env node

/**
 * Docker环境检查脚本
 * 检查Docker是否安装并正常运行
 */

const { exec } = require('child_process');

async function checkDocker() {
  console.log('🔍 检查Docker环境...\n');

  try {
    // 检查Docker是否安装
    console.log('1. 检查Docker是否安装...');
    await execCommand('docker --version');
    console.log('✅ Docker已安装\n');

    // 检查Docker是否运行
    console.log('2. 检查Docker是否运行...');
    await execCommand('docker info');
    console.log('✅ Docker正在运行\n');

    // 检查基础镜像
    console.log('3. 检查Ubuntu镜像...');
    try {
      await execCommand('docker image inspect ubuntu:22.04');
      console.log('✅ Ubuntu 22.04镜像已存在\n');
    } catch (error) {
      console.log('⚠️ Ubuntu 22.04镜像不存在，正在拉取...');
      try {
        await execCommand('docker pull ubuntu:22.04');
        console.log('✅ Ubuntu 22.04镜像拉取完成\n');
      } catch (pullError) {
        console.log('❌ 拉取Ubuntu镜像失败');
        console.log('请手动执行: docker pull ubuntu:22.04\n');
      }
    }

    // 测试容器创建
    console.log('4. 测试容器创建...');
    try {
      const result = await execCommand('docker run --rm ubuntu:22.04 echo "Hello from container"');
      if (result.includes('Hello from container')) {
        console.log('✅ 容器创建测试成功\n');
      }
    } catch (error) {
      console.log('❌ 容器创建测试失败');
      console.log('错误:', error.message, '\n');
    }

    // 检查资源限制
    console.log('5. 检查资源限制支持...');
    try {
      await execCommand('docker run --rm --memory=100m --cpus=0.1 ubuntu:22.04 echo "Resource limits work"');
      console.log('✅ 资源限制支持正常\n');
    } catch (error) {
      console.log('⚠️ 资源限制可能不支持');
      console.log('这不会影响基本功能，但建议升级Docker版本\n');
    }

    console.log('🎉 Docker环境检查完成！');
    console.log('您可以使用容器模式启动WebSSH服务器：');
    console.log('npm start');
    console.log('\n或者使用本地模式：');
    console.log('USE_CONTAINERS=false npm start');

  } catch (error) {
    console.log('❌ Docker环境检查失败\n');
    console.log('错误信息:', error.message);
    console.log('\n解决方案：');
    console.log('1. 安装Docker: https://docs.docker.com/get-docker/');
    console.log('2. 启动Docker服务');
    console.log('3. 确保当前用户有Docker权限');
    console.log('\n您也可以使用本地模式（不需要Docker）：');
    console.log('USE_CONTAINERS=false npm start');
    
    process.exit(1);
  }
}

function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

// 运行检查
if (require.main === module) {
  checkDocker();
}

module.exports = { checkDocker };
