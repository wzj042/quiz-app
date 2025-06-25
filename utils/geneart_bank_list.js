const fs = require('fs').promises;
const path = require('path');

// 配置要忽略的目录
const IGNORE_DIRS = ['archive'];

async function scanDirectory(dir, baseDir = null) {
    const files = await fs.readdir(dir);
    const bankList = [];
    
    // 如果baseDir未设置，将其设置为当前目录（用于第一次调用）
    if (!baseDir) {
        baseDir = dir;
    }

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
            // 检查是否是需要忽略的目录
            const dirName = path.basename(fullPath);
            if (IGNORE_DIRS.includes(dirName)) {
                console.log(`Skipping ignored directory: ${dirName}`);
                continue;
            }
            // 如果不是被忽略的目录，则递归扫描
            const subList = await scanDirectory(fullPath, baseDir);
            bankList.push(...subList);
        } else if (file.endsWith('.json') && file !== 'list.json') {
            try {
                // 读取JSON文件内容
                const content = await fs.readFile(fullPath, 'utf8');
                const data = JSON.parse(content);
                
                // 计算相对路径
                const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
                
                // 确保文件包含必要的数据
                if (data.sets && data.sets.length > 0) {
                    bankList.push({
                        file: relativePath,
                        name: data.sets[0].name || path.basename(relativePath, '.json'),
                        category: data.sets[0].category || '未分类'
                    });
                }
            } catch (err) {
                console.warn(`Warning: Could not process ${file}:`, err);
            }
        }
    }

    return bankList;
}

async function generateBankList() {
    try {
        const assetsDir = path.join(__dirname, '..', 'assets');
        const bankList = await scanDirectory(assetsDir);
        
        // 生成list.json文件，添加更新时间
        const outputData = {
            updateTime: new Date().toLocaleString('zh-CN', {
                timeZone: 'Asia/Shanghai',
                hour12: false,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).replace(/\//g, '-'),
            banks: bankList
        };
        const outputPath = path.join(assetsDir, 'list.json');
        await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2));
        
        console.log(`Successfully generated list.json with ${bankList.length} quiz banks`);
    } catch (err) {
        console.error('Error generating bank list:', err);
        process.exit(1);
    }
}

// 如果直接运行此脚本，则执行生成
if (require.main === module) {
    generateBankList();
}

module.exports = generateBankList;
