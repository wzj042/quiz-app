const fs = require('fs').promises;
const path = require('path');

// 配置要忽略的目录
const IGNORE_DIRS = ['archive'];

async function scanDirectory(dir) {
    const files = await fs.readdir(dir);
    const bankList = [];

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
            const subList = await scanDirectory(fullPath);
            bankList.push(...subList);
        } else if (file.endsWith('.json')) {
            try {
                // 读取JSON文件内容
                const content = await fs.readFile(fullPath, 'utf8');
                const data = JSON.parse(content);
                
                // 确保文件有sets数组且不为空
                if (data.sets && data.sets.length > 0) {
                    // 使用相对于assets目录的路径
                    const relativePath = path.relative(
                        path.join(__dirname, '..', 'assets'),
                        fullPath
                    );
                    
                    bankList.push({
                        file: relativePath,
                        name: data.sets[0].name // 使用第一个set的名称
                    });
                }
            } catch (err) {
                console.error(`Error processing ${file}:`, err);
            }
        }
    }

    return bankList;
}

async function generateBankList() {
    try {
        const assetsDir = path.join(__dirname, '..', 'assets');
        const bankList = await scanDirectory(assetsDir);
        
        // 生成list.json文件
        const outputPath = path.join(assetsDir, 'list.json');
        await fs.writeFile(outputPath, JSON.stringify(bankList, null, 2));
        
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
