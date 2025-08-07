/**
 * 示例数据初始化器
 * 为新用户提供示例文档和知识库
 */

import { v4 as uuidv4 } from 'uuid';
import Database from "@tauri-apps/plugin-sql";
import { KnowledgeService } from './knowledgeService';
import { UnifiedFileService } from './unifiedFileService';
import { getDatabaseURI } from './config/database';
import { StorageUtil, specializedStorage } from './storage';

interface SampleDocument {
  title: string;
  content: string;
  fileType: string;
  tags?: string[];
}

interface SampleKnowledgeBase {
  name: string;
  description: string;
  icon: string;
  isEncrypted: boolean;
  documents: SampleDocument[];
}

/**
 * 预设示例数据 - 包含完整的示例内容
 */
const SAMPLE_DATA: SampleKnowledgeBase[] = [
  {
    name: '咖啡文化完全指南',
    description: [
      '这是一个关于咖啡文化的完整知识库，包含咖啡品种、制作方法、产地介绍等丰富内容。',
      '',
      '📋 使用步骤：',
      '1. 首先在【设置】中配置嵌入生成服务（Ollama 或本地 ONNX）',
      '2. 然后点击【添加文档】将示例文档添加到此知识库',
      '3. 等待文档索引完成后即可在聊天中引用',
      '',
      '💡 提示：示例文档已自动创建在资源页面，您可以直接选择添加。',
      '',
      '🔍 测试建议：尝试问一些具体问题，如：',
      '- "意式浓缩咖啡怎么制作？"',
      '- "埃塞俄比亚咖啡有什么特点？"',
      '- "拿铁和卡布奇诺有什么区别？"'
    ].join('\\n'),
    icon: 'coffee',
    isEncrypted: false,
    documents: [
      {
        title: '咖啡品种与产地指南.md',
        fileType: 'md',
        tags: ['咖啡', '品种', '产地'],
        content: `# 咖啡品种与产地指南

## 主要咖啡品种

### 阿拉比卡咖啡（Arabica）
阿拉比卡咖啡是世界上最受欢迎的咖啡品种，约占全球咖啡产量的60-70%。

**特点：**
- 口感温和，酸度适中
- 香气丰富，层次复杂
- 咖啡因含量较低（约1.2-1.5%）
- 生长海拔较高（600-2000米）
- 对病虫害敏感，种植难度较高

**主要亚种：**
- **铁皮卡（Typica）**：最古老的阿拉比卡品种，口感纯净
- **波旁（Bourbon）**：甜度高，酸度明亮
- **卡杜拉（Caturra）**：产量高，酸度活泼
- **卡杜艾（Catuai）**：抗风性强，适应性好

### 罗布斯塔咖啡（Robusta）
罗布斯塔咖啡约占全球咖啡产量的30-40%，主要用于制作意式浓缩咖啡和速溶咖啡。

**特点：**
- 口感浓烈，苦味明显
- 咖啡因含量高（约2.2-2.7%）
- 生长海拔较低（0-600米）
- 抗病虫害能力强
- 价格相对便宜

## 世界主要咖啡产区

### 非洲产区

#### 埃塞俄比亚
被誉为咖啡的发源地，拥有丰富的原生咖啡品种。

**著名产区：**
- **耶加雪菲（Yirgacheffe）**：花香浓郁，酸度明亮，有柠檬和茶香
- **西达摩（Sidamo）**：果香丰富，酸度平衡
- **哈拉尔（Harrar）**：酒香浓郁，口感厚重

**处理方式：**
- 日晒处理：果香浓郁，甜度高
- 水洗处理：酸度明亮，口感干净

#### 肯尼亚
以高品质的水洗阿拉比卡咖啡闻名。

**特点：**
- 酸度明亮，如黑醋栗般的果酸
- 口感饱满，层次丰富
- 采用独特的双重发酵水洗法

### 中南美洲产区

#### 哥伦比亚
世界第三大咖啡生产国，以高品质阿拉比卡咖啡著称。

**著名产区：**
- **薇拉（Huila）**：甜度高，酸度平衡
- **娜玲珑（Nariño）**：酸度明亮，花香浓郁
- **考卡（Cauca）**：口感复杂，层次丰富

#### 巴西
世界最大的咖啡生产国，产量约占全球的三分之一。

**特点：**
- 以罗布斯塔和阿拉比卡混合种植
- 口感平衡，苦甜适中
- 主要采用日晒处理法
- 是意式浓缩咖啡的重要原料

#### 牙买加
以蓝山咖啡闻名世界。

**蓝山咖啡特点：**
- 生长在海拔1000-2000米的蓝山山脉
- 口感温和，酸度低
- 香气优雅，无苦味
- 价格昂贵，被誉为咖啡中的劳斯莱斯

### 亚洲产区

#### 印度尼西亚
以独特的湿刨法处理闻名。

**著名产区：**
- **苏门答腊（Sumatra）**：口感厚重，草本香气
- **爪哇（Java）**：酸度低，口感平衡
- **苏拉威西（Sulawesi）**：口感复杂，层次丰富

#### 越南
世界第二大咖啡生产国，主要生产罗布斯塔咖啡。

**特点：**
- 以罗布斯塔为主（约95%）
- 口感浓烈，适合制作越南滴漏咖啡
- 价格便宜，产量巨大

## 咖啡处理法

### 日晒处理法（Natural Process）
最古老的咖啡处理方法。

**流程：**
1. 采摘成熟的咖啡樱桃
2. 直接在阳光下晾晒2-4周
3. 去除干燥的果肉和羊皮纸
4. 得到生咖啡豆

**特点：**
- 果香浓郁，甜度高
- 口感厚重，层次复杂
- 风险较高，容易产生瑕疵

### 水洗处理法（Washed Process）
现代最常用的处理方法。

**流程：**
1. 采摘成熟的咖啡樱桃
2. 去除果肉，保留粘膜
3. 发酵12-48小时去除粘膜
4. 清洗干净后晾晒
5. 去除羊皮纸得到生豆

**特点：**
- 酸度明亮，口感干净
- 能突出咖啡的本味
- 品质稳定，瑕疵率低

### 蜜处理法（Honey Process）
介于日晒和水洗之间的处理方法。

**分类：**
- **白蜜**：去除80-100%粘膜
- **黄蜜**：去除50-80%粘膜
- **红蜜**：去除0-50%粘膜
- **黑蜜**：完全保留粘膜

**特点：**
- 甜度介于日晒和水洗之间
- 口感平衡，层次丰富
- 处理难度适中

这份指南为咖啡爱好者提供了全面的品种和产地知识，帮助大家更好地理解和欣赏咖啡的多样性。`
      },
      {
        title: '咖啡制作技巧大全.md',
        fileType: 'md',
        tags: ['制作', '技巧', '冲泡'],
        content: `# 咖啡制作技巧大全

## 意式浓缩咖啡制作

### 基础意式浓缩（Espresso）

**所需设备：**
- 意式咖啡机
- 磨豆机
- 压粉器
- 电子秤
- 计时器

**制作步骤：**
1. **研磨咖啡豆**：使用细研磨度，粉末应该像细盐一样
2. **称量咖啡粉**：单份18-20克，双份36-40克
3. **布粉**：将咖啡粉均匀分布在手柄中
4. **压粉**：用30磅力度垂直向下压实
5. **萃取**：25-30秒萃取出25-30ml的浓缩咖啡

**关键参数：**
- 研磨度：细研磨
- 粉量：18-20g（单份）
- 萃取时间：25-30秒
- 萃取量：25-30ml
- 水温：90-96°C

**品质判断：**
- **Crema**：金黄色泡沫，厚度2-3mm
- **流速**：像蜂蜜一样缓慢流出
- **口感**：浓郁香醇，回甘明显

### 卡布奇诺（Cappuccino）

**配比：**
- 1/3 意式浓缩咖啡
- 1/3 热牛奶
- 1/3 奶泡

**制作步骤：**
1. 制作一份意式浓缩咖啡
2. 打发牛奶至60-65°C，形成细腻奶泡
3. 先倒入热牛奶，再舀入奶泡
4. 可在表面撒肉桂粉装饰

**奶泡要求：**
- 温度：60-65°C
- 质地：细腻光滑，像丝绸一样
- 厚度：约1cm

### 拿铁咖啡（Latte）

**配比：**
- 1/6 意式浓缩咖啡
- 4/6 热牛奶
- 1/6 奶泡

**制作步骤：**
1. 制作一份意式浓缩咖啡
2. 打发牛奶，奶泡较薄
3. 将热牛奶倒入咖啡中
4. 在表面铺一层薄奶泡

**拉花技巧：**
- 奶壶高度：距离杯面3-5cm
- 倾倒速度：先慢后快
- 手腕摆动：制作叶子或心形图案

## 手冲咖啡制作

### V60手冲法

**所需设备：**
- V60滤杯
- V60滤纸
- 手冲壶
- 电子秤
- 计时器

**制作步骤：**
1. **准备工作**：
   - 将滤纸放入滤杯，用热水冲洗
   - 预热滤杯和分享壶
   - 研磨咖啡豆（中细研磨）

2. **冲泡参数**：
   - 咖啡粉：20g
   - 水量：300ml
   - 水温：90-96°C
   - 研磨度：中细研磨
   - 冲泡时间：2分30秒-3分钟

3. **冲泡步骤**：
   - **第一次注水（闷蒸）**：30秒内注入40ml水，闷蒸30秒
   - **第二次注水**：1分钟内注入100ml水
   - **第三次注水**：1分30秒内注入160ml水
   - **完成萃取**：等待滴滤完成

**注水技巧：**
- 从中心开始，螺旋式向外注水
- 保持水流稳定，避免冲击粉床
- 控制水位高度，避免过满

### 法式压壶（French Press）

**制作步骤：**
1. **预热压壶**：用热水冲洗压壶
2. **加入咖啡粉**：粗研磨，比例1:15（20g咖啡粉：300ml水）
3. **注入热水**：水温90-96°C，注满压壶
4. **搅拌**：轻轻搅拌确保咖啡粉完全浸湿
5. **浸泡**：盖上盖子，浸泡4分钟
6. **压滤**：缓慢下压滤网
7. **立即享用**：避免过度萃取

**特点：**
- 口感厚重，油脂丰富
- 制作简单，适合新手
- 能完整保留咖啡的天然油脂

### 爱乐压（AeroPress）

**制作步骤：**
1. **组装设备**：将滤纸放入滤帽，拧紧
2. **加入咖啡粉**：中细研磨，17g
3. **注入热水**：水温80-85°C，注入250ml
4. **搅拌**：搅拌10秒
5. **浸泡**：等待1分钟
6. **压制**：30秒内缓慢下压

**特点：**
- 萃取时间短，口感干净
- 便携性好，适合旅行
- 可制作浓缩咖啡风格

## 冷萃咖啡制作

### 冷萃浓缩液

**制作步骤：**
1. **研磨**：粗研磨咖啡豆
2. **配比**：1:8（100g咖啡粉：800ml冷水）
3. **浸泡**：室温浸泡12-24小时
4. **过滤**：用细网或滤纸过滤
5. **保存**：冷藏保存，可保持1-2周

**饮用方式：**
- 直接饮用（浓缩液）
- 加水稀释（1:1或1:2）
- 加牛奶制作冰拿铁
- 加气泡水制作气泡咖啡

### 日式冰滴咖啡

**制作步骤：**
1. **准备设备**：冰滴咖啡器
2. **研磨咖啡**：中细研磨，40g
3. **装填咖啡粉**：平铺在滤网中
4. **调节滴速**：每秒1-2滴
5. **滴滤时间**：3-6小时
6. **完成**：得到约400ml冰滴咖啡

**特点：**
- 口感顺滑，酸度低
- 香气浓郁，层次丰富
- 制作时间长，但风味独特

## 咖啡品鉴技巧

### 品鉴步骤

1. **观察**：观察咖啡的颜色和透明度
2. **闻香**：感受干香和湿香
3. **品尝**：小口品尝，感受口感层次
4. **回味**：体验咖啡的余韵

### 风味轮

**酸度类型：**
- 柑橘酸：柠檬、橙子、葡萄柚
- 果酸：苹果、樱桃、浆果
- 酒酸：红酒、白兰地

**甜度类型：**
- 焦糖甜：焦糖、蜂蜜、红糖
- 果甜：水果、花蜜
- 巧克力甜：可可、牛奶巧克力

**香气类型：**
- 花香：茉莉、玫瑰、薰衣草
- 果香：浆果、热带水果
- 坚果香：杏仁、榛子、核桃

这份制作指南涵盖了从意式浓缩到手冲咖啡的各种制作方法，帮助咖啡爱好者掌握专业的制作技巧。`
      },
      {
        title: '咖啡店文化与礼仪.txt',
        fileType: 'txt',
        tags: ['文化', '礼仪', '咖啡店'],
        content: `咖啡店文化与礼仪指南

=== 咖啡店的历史与文化 ===

咖啡店的起源
咖啡店最早出现在16世纪的奥斯曼帝国，被称为"智慧学校"，是人们聚集讨论政治、文学和哲学的场所。

欧洲咖啡馆文化
17世纪，咖啡传入欧洲后，咖啡馆成为启蒙运动的重要场所：
- 伦敦的咖啡馆被称为"便士大学"
- 维也纳咖啡馆是文学家和艺术家的聚集地
- 巴黎咖啡馆见证了无数革命和思想交流

现代咖啡店文化
今天的咖啡店不仅是饮品场所，更是：
- 社交空间：朋友聚会、商务会谈
- 工作场所：远程办公、学习空间
- 文化中心：艺术展览、音乐演出
- 第三空间：介于家庭和工作之间的放松场所

=== 不同国家的咖啡文化 ===

意大利咖啡文化
- 早晨只喝卡布奇诺，下午只喝浓缩咖啡
- 站着喝咖啡是传统，坐着喝需要额外付费
- 绝不在餐后喝加奶的咖啡
- 浓缩咖啡通常一口喝完

法国咖啡文化
- 咖啡是社交的重要组成部分
- 喜欢在户外露台享用咖啡
- 咖啡时间通常很长，用于聊天和观察路人
- 经典饮品是咖啡欧蕾（Café au Lait）

美国咖啡文化
- 大杯咖啡文化的发源地
- 重视便利性和效率
- 星巴克等连锁品牌的全球化推广
- 第三波咖啡浪潮的兴起，注重咖啡品质

日本咖啡文化
- 极致的精细化和仪式感
- 虹吸壶咖啡的发扬光大
- 安静的咖啡店环境
- 对咖啡师技艺的极高要求

澳大利亚咖啡文化
- 平白咖啡（Flat White）的发源地
- 重视咖啡豆的品质和烘焙
- 咖啡师文化非常发达
- 早餐咖啡文化盛行

=== 咖啡店礼仪指南 ===

点餐礼仪
1. 排队等候：耐心排队，不要插队
2. 提前决定：在排队时就想好要点什么
3. 清楚表达：明确说出饮品名称和要求
4. 礼貌用语：使用"请"、"谢谢"等礼貌用语
5. 支付方式：准备好现金或银行卡

座位礼仪
1. 合理选择：根据停留时间选择合适座位
2. 物品管理：不要用物品占座太久
3. 音量控制：保持适当的谈话音量
4. 清理桌面：离开时清理自己的桌面
5. 尊重他人：不要长时间占用热门座位

工作学习礼仪
1. 购买消费：在咖啡店工作学习要适当消费
2. 时间控制：高峰期避免长时间占座
3. 设备使用：合理使用电源插座
4. 网络使用：不要占用过多带宽
5. 环境维护：保持安静，不影响他人

社交礼仪
1. 约会准时：约在咖啡店要准时到达
2. 手机使用：避免长时间使用手机
3. 谈话音量：控制谈话音量，不影响他人
4. 尊重隐私：不要偷听他人谈话
5. 友好互动：对服务员保持友好态度

=== 咖啡师文化 ===

咖啡师的职业精神
- 对咖啡品质的极致追求
- 持续学习和技艺提升
- 为客户提供优质服务体验
- 传播咖啡文化和知识

咖啡师技能要求
1. 基础技能：
   - 意式咖啡机操作
   - 磨豆机调节
   - 奶泡制作技巧
   - 拉花艺术

2. 进阶技能：
   - 咖啡豆知识
   - 烘焙理解
   - 萃取参数调节
   - 感官品鉴能力

3. 服务技能：
   - 客户沟通
   - 产品推荐
   - 问题解决
   - 团队协作

咖啡师认证体系
- SCA（精品咖啡协会）认证
- CQI（咖啡品质研究所）认证
- 各国本土咖啡师认证
- 咖啡烘焙师认证

=== 咖啡店经营文化 ===

独立咖啡店特色
- 个性化装修和氛围
- 精选咖啡豆和独特配方
- 与当地社区的紧密联系
- 咖啡师与客户的深度交流

连锁咖啡店优势
- 标准化的产品和服务
- 便利的地理位置
- 稳定的品质保证
- 高效的服务流程

第三波咖啡浪潮
- 将咖啡视为精品农产品
- 强调咖啡的产地和处理法
- 追求咖啡的独特风味
- 提升咖啡的整体体验

可持续发展理念
- 公平贸易咖啡豆采购
- 环保包装材料使用
- 减少食物浪费
- 支持咖啡产地发展

=== 咖啡与生活方式 ===

咖啡与健康
- 适量饮用咖啡的健康益处
- 咖啡因摄入量的控制
- 不同时间段的饮用建议
- 特殊人群的饮用注意事项

咖啡与社交
- 咖啡约会的魅力
- 商务会谈的咖啡选择
- 朋友聚会的咖啡文化
- 家庭咖啡时光的营造

咖啡与工作
- 咖啡提升工作效率的科学原理
- 办公室咖啡文化的建立
- 咖啡休息时间的重要性
- 远程工作中的咖啡仪式感

这份指南帮助大家更好地理解和融入咖啡店文化，享受高品质的咖啡体验。`
      }
    ]
  }
];

export class SampleDataInitializer {
  private static readonly INIT_FLAG_KEY = 'sample_data_initialized';
  
  private static readonly SAMPLE_DATA_HASHES = {
    knowledgeBases: {
      '咖啡文化完全指南': 'coffee_kb_hash_v1_2024',
    } as Record<string, string>,
    documents: {
      '咖啡品种与产地指南': 'coffee_varieties_hash_v1_2024',
      '咖啡制作技巧手册': 'coffee_brewing_hash_v1_2024', 
      '咖啡店文化与礼仪': 'coffee_culture_hash_v1_2024'
    } as Record<string, string>
  };

  static async isInitialized(): Promise<boolean> {
    try {
      let storageFlag = false;
      try {
        storageFlag = await specializedStorage.sampleData.getInitialized() === true;
      } catch (storageError) {
        console.warn('读取存储标记失败，将检查数据库状态:', storageError);
      }

      let hasExistingData = false;
      try {
        const knowledgeBases = await KnowledgeService.getAllKnowledgeBases();
        
        for (const sampleKB of SAMPLE_DATA) {
          const existing = knowledgeBases.find(kb => kb.name === sampleKB.name);
          if (existing) {
            hasExistingData = true;
            console.log(`发现已存在的示例知识库: ${sampleKB.name} (ID: ${existing.id})`);
          }
        }
      } catch (dbError) {
        console.warn('检查数据库状态失败:', dbError);
      }

      const isInitialized = storageFlag || hasExistingData;
      
      if (isInitialized && !storageFlag) {
        console.log('检测到数据库中有示例数据但存储标记缺失，正在修复...');
        await this.markAsInitialized();
      }

      console.log(`初始化状态检查: 存储标记=${storageFlag}, 数据库数据=${hasExistingData}, 最终结果=${isInitialized}`);
      return isInitialized;
      
    } catch (error) {
      console.error('检查初始化状态失败:', error);
      return false;
    }
  }

  static async markAsInitialized(): Promise<void> {
    try {
      await specializedStorage.sampleData.setInitialized(true);
      console.log('示例数据初始化状态已标记');
    } catch (error) {
      console.error('标记初始化状态失败:', error);
    }
  }

  static async resetInitialization(): Promise<void> {
    try {
      await specializedStorage.sampleData.clearInitialized();
      await specializedStorage.sampleData.clearLock();
      console.log('初始化状态已重置');
    } catch (error) {
      console.error('重置初始化状态失败:', error);
      throw error;
    }
  }
  static async fullReset(
    options: {
      onProgress?: (step: string, progress: number) => void;
    } = {}
  ): Promise<void> {
    const { onProgress } = options;
    
    console.log('🗑️ 开始完整数据重置...');
    onProgress?.('开始完整数据重置', 0);

    try {
      // 1. 清理数据库数据
      onProgress?.('清理数据库数据', 10);
      await this.clearDatabaseData();

      // 2. 清理Tauri存储数据
      onProgress?.('清理Tauri存储数据', 30);
      await this.clearTauriStorage();

      // 3. 清理所有文档文件
      onProgress?.('清理文档文件', 50);
      await this.clearDocumentFiles();

      // 4. 重置配置
      onProgress?.('重置应用配置', 70);
      await this.resetAppConfig();

      // 5. 重置初始化状态
      onProgress?.('重置初始化状态', 90);
      await this.resetInitialization();

      onProgress?.('完整重置完成', 100);
      console.log('🎉 完整数据重置完成！');

    } catch (error) {
      console.error('完整重置失败:', error);
      throw error;
    }
  }

  /**
   * 清理数据库数据
   */
  private static async clearDatabaseData(): Promise<void> {
    try {
      console.log('🗃️ 清理数据库数据...');
      
      // 使用共享的数据库服务，而不是创建独立连接
      const { DatabaseService } = await import('./database/services/DatabaseService');
      const dbService = DatabaseService.getInstance();
      const dbManager = dbService.getDbManager();
      
      // 优先尝试删除数据库文件（仅在 Tauri 环境生效）
      try {
        // @ts-ignore
        const { removeFile } = await import('@tauri-apps/plugin-fs');
        const { join, appDataDir } = await import('@tauri-apps/api/path');
        const dbPath = await join(await appDataDir(), 'mychat.db');
        await removeFile(dbPath);
        console.log(`已删除数据库文件: ${dbPath}`);
        return; // 删除成功，停止后续逐表清空
      } catch (e) {
        console.warn('无法删除数据库文件，回退到逐表清空方式:', e);
      }

      // ↓ 回退方案：逐表清空

      // ↓ 回退方案：动态删除所有用户表（含迁移元表）
      const userTables = await dbManager.select<{name: string}>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );

      for (const row of userTables) {
        const table = row.name;
        try {
          await dbManager.execute(`DROP TABLE IF EXISTS \"${table}\"`);
          console.log(`已清理表: ${table}`);
        } catch (tableError) {
          // 表可能不存在，继续处理其他表
          console.warn(`⚠️ 清理表 ${table} 失败（可能不存在）:`, tableError);
        }
      }

      console.log('数据库数据清理完成');
    } catch (error) {
      console.error('清理数据库数据失败:', error);
      throw error;
    }
  }

  /**
   * 清理Tauri存储数据
   */
  private static async clearTauriStorage(): Promise<void> {
    try {
      console.log('💾 清理Tauri存储数据...');
      
      // 使用 StorageUtil 的统一清理方法
      const result = await StorageUtil.clearAllAppData();
      
      console.log(`Tauri存储数据清理完成:`);
      console.log(`  - 清理了 ${result.tauriStoresCleared} 个 Tauri Store 文件`);
      console.log(`  - 清理了 ${result.localStorageKeysCleared} 个 localStorage 项目`);
      
      if (result.errors.length > 0) {
        console.warn(`⚠️ 清理过程中发生 ${result.errors.length} 个错误:`);
        result.errors.forEach(error => console.warn(`  - ${error}`));
      }
      
    } catch (error) {
      console.error('清理Tauri存储数据失败:', error);
      throw error;
    }
  }

  /**
   * 清理所有文档文件
   */
  private static async clearDocumentFiles(): Promise<void> {
    try {
      console.log('📁 清理文档文件...');
      
      // 1. 清理统一文件服务系统中的文件
      try {
        const { UnifiedFileService } = await import('./unifiedFileService');
        
        // 获取所有文件
        const files = await UnifiedFileService.getAllFiles();
        console.log(`发现 ${files.length} 个统一文件系统文件需要清理`);

        // 删除每个文件
        for (const file of files) {
          try {
            await UnifiedFileService.deleteFile(file.id);
            console.log(`已删除统一文件: ${file.name}`);
          } catch (deleteError) {
            console.warn(`⚠️ 删除统一文件 ${file.name} 失败:`, deleteError);
          }
        }

        // 清理统一文件目录
        try {
          if (typeof window !== 'undefined') {
            const { remove } = await import('@tauri-apps/plugin-fs');
            const { appDataDir } = await import('@tauri-apps/api/path');
            
            const appDir = await appDataDir();
            const filesDir = `${appDir}/files`;
            
            try {
              await remove(filesDir, { recursive: true });
              console.log('已清理统一文件目录');
            } catch (dirError) {
              console.warn('⚠️ 清理统一文件目录失败（可能不存在）:', dirError);
            }
          }
        } catch (fsError) {
          console.warn('⚠️ 无法清理统一文件目录:', fsError);
        }

        console.log('统一文件系统清理完成');
      } catch (unifiedError) {
        console.warn('⚠️ 清理统一文件系统失败:', unifiedError);
      }

      // 2. 清理旧的DocumentService系统（兼容性）
      try {
        // DocumentService已删除，使用UnifiedFileService清理旧文档
        console.log('DocumentService已移除，无需清理旧系统文档');

        // 清理旧文档目录
        try {
          if (typeof window !== 'undefined') {
            const { remove } = await import('@tauri-apps/plugin-fs');
            const { appDataDir } = await import('@tauri-apps/api/path');
            
            const appDir = await appDataDir();
            const documentsDir = `${appDir}/documents`;
            
            try {
              await remove(documentsDir, { recursive: true });
              console.log('已清理旧文档目录');
            } catch (dirError) {
              console.warn('⚠️ 清理旧文档目录失败（可能不存在）:', dirError);
            }
          }
        } catch (fsError) {
          console.warn('⚠️ 无法清理旧文档目录:', fsError);
        }

        console.log('旧系统文档清理完成');
      } catch (oldSystemError) {
        console.warn('⚠️ 清理旧文档系统失败:', oldSystemError);
      }

      // 3. 清理uploads目录（FileService遗留）
      try {
        if (typeof window !== 'undefined') {
          const { remove } = await import('@tauri-apps/plugin-fs');
          const { appDataDir } = await import('@tauri-apps/api/path');
          
          const appDir = await appDataDir();
          const uploadsDir = `${appDir}/uploads`;
          
          try {
            await remove(uploadsDir, { recursive: true });
            console.log('已清理uploads目录');
          } catch (dirError) {
            console.warn('⚠️ 清理uploads目录失败（可能不存在）:', dirError);
          }
        }
      } catch (uploadsError) {
        console.warn('⚠️ 无法清理uploads目录:', uploadsError);
      }

      console.log('所有文档文件清理完成');
    } catch (error) {
      console.error('清理文档文件失败:', error);
      throw error;
    }
  }

  /**
   * 重置应用配置
   */
  private static async resetAppConfig(): Promise<void> {
    try {
      console.log('⚙️ 重置应用配置...');
      
      // 重置知识库配置
      try {
        const { getKnowledgeBaseConfigManager } = await import('./knowledgeBaseConfig');
        const configManager = getKnowledgeBaseConfigManager();
        await configManager.resetToDefault();
        console.log('已重置知识库配置');
      } catch (configError) {
        console.warn('⚠️ 重置知识库配置失败:', configError);
      }

      // 重置嵌入服务配置 - 清理相关存储
      try {
        // 清理嵌入相关的 StorageUtil 存储
        const embeddingStores = [
          'model-downloads.json',
          'model-manager.json', 
          'ollama-models.json',
          'model-usage.json'
        ];
        
        for (const store of embeddingStores) {
          try {
            await StorageUtil.clear(store);
            console.log(`已清理嵌入服务存储: ${store}`);
          } catch (storeError) {
            console.warn(`⚠️ 清理存储 ${store} 失败:`, storeError);
          }
        }
        
        // 同时清理可能遗留的 localStorage 键
        if (typeof window !== 'undefined') {
          const embeddingKeys = Object.keys(localStorage).filter(key => 
            key.includes('embedding') || key.includes('onnx') || key.includes('ollama')
          );
          
          for (const key of embeddingKeys) {
            localStorage.removeItem(key);
          }
          
          if (embeddingKeys.length > 0) {
            console.log(`已清理 ${embeddingKeys.length} 个嵌入服务相关的 localStorage 项目`);
          }
        }
        
        console.log('已重置嵌入服务配置');
      } catch (embeddingError) {
        console.warn('⚠️ 重置嵌入服务配置失败:', embeddingError);
      }

      console.log('应用配置重置完成');
    } catch (error) {
      console.error('重置应用配置失败:', error);
      throw error;
    }
  }

  /**
   * 初始化示例数据 - 创建示例文档和空的知识库
   * 使用更强的去重逻辑和事务保护
   */
  static async initializeAll(
    options: {
      onProgress?: (step: string, progress: number) => void;
      overrideExisting?: boolean;
    } = {}
  ): Promise<void> {
    const { onProgress, overrideExisting = false } = options;

    console.log('🚀 开始安全初始化示例数据...');
    console.log('📊 初始化选项:', { overrideExisting });
    
    // 使用锁机制防止并发初始化
    try {
      // 检查是否正在初始化
      const isLockExpired = await specializedStorage.sampleData.isLockExpired();
      const existingLock = await specializedStorage.sampleData.getLock();
      
      if (existingLock && !isLockExpired) {
        console.log('⏳ 示例数据正在初始化中，跳过重复操作');
        onProgress?.('示例数据正在初始化中', 50);
        return;
      } else if (existingLock && isLockExpired) {
        console.log('⚠️ 发现过期的初始化锁，将清除并继续');
        await specializedStorage.sampleData.clearLock();
      }

      // 设置初始化锁
      await specializedStorage.sampleData.setLock(Date.now().toString());
      console.log('🔒 已设置初始化锁');

      // 检查是否已经初始化
      if (!overrideExisting && await this.isInitialized()) {
        // 双重检查：验证数据完整性
        console.log('📋 检查数据完整性...');
        const validation = await this.validateData();
        if (validation.isValid) {
          console.log('示例数据已完整存在，跳过初始化');
          onProgress?.('示例数据已存在', 100);
          return;
        } else {
          console.log('⚠️ 示例数据存在但不完整，继续初始化');
          console.log('发现的问题:', validation.issues);
        }
      }

      console.log('🚀 开始安全初始化示例数据...');
      onProgress?.('开始初始化示例数据', 0);

      // 1. 强制清理所有重复数据（增强版）
      onProgress?.('强制清理重复数据', 5);
      await this.forceCleanupAllDuplicates({
        onProgress: (step, prog) => {
          const adjustedProgress = 5 + (prog * 0.1); // 5%-15%
          onProgress?.(`清理: ${step}`, adjustedProgress);
        }
      });

      // 2. 确保数据库连接可用（优化后的验证）
      onProgress?.('验证数据库连接', 10);
      try {
        // 先尝试验证现有连接
        await KnowledgeService.getAllKnowledgeBases();
        console.log('数据库连接验证成功');
      } catch (connectionError) {
        console.log('⚠️ 数据库连接验证失败，尝试重新初始化...');
        await KnowledgeService.initDb();
        console.log('数据库连接重新建立成功');
      }

      let totalDocuments = 0;
      for (const sampleKB of SAMPLE_DATA) {
        totalDocuments += sampleKB.documents.length;
      }

      const totalSteps = SAMPLE_DATA.length + totalDocuments;
      let currentStep = 0;

      // 3. 原子性创建知识库和文档
      for (const sampleKB of SAMPLE_DATA) {
        onProgress?.(`创建知识库: ${sampleKB.name}`, 20 + (currentStep / totalSteps) * 60);
        
        // 3.1 使用增强的唯一性检查创建知识库
        console.log(`📂 检查知识库: ${sampleKB.name}`);
        let knowledgeBase = await this.checkKnowledgeBaseExists(sampleKB);
        if (!knowledgeBase) {
          knowledgeBase = await this.createKnowledgeBaseSafely(sampleKB);
        }
        currentStep++;

        // 3.2 创建示例文档文件（但不添加到知识库）
        for (const sampleDoc of sampleKB.documents) {
          const docProgress = 20 + (currentStep / totalSteps) * 60;
          onProgress?.(`创建示例文档: ${sampleDoc.title}`, docProgress);
          
          let document = await this.checkDocumentExists(sampleDoc, sampleKB.name);
          if (!document) {
            document = await this.createDocumentSafely(sampleDoc, sampleKB.name);
          }
          currentStep++;
        }

        console.log(`知识库处理完成: ${sampleKB.name} (空知识库，等待用户添加文档)`);
      }

      // 4. 标记为已初始化
      onProgress?.('完成初始化设置', 90);
      await this.markAsInitialized();

      onProgress?.('示例数据初始化完成', 100);
      console.log(`🎉 示例数据初始化完成！`);
      console.log(`📊 创建了 ${SAMPLE_DATA.length} 个空知识库，${totalDocuments} 个示例文档`);
      console.log(`💡 用户需要：1. 配置嵌入服务 → 2. 手动添加文档到知识库 → 3. 等待索引完成`);

    } catch (error) {
      console.error('❌ 示例数据初始化失败:', error);
      throw error;
    } finally {
      // 清除初始化锁
      try {
        await specializedStorage.sampleData.clearLock();
      } catch (lockError) {
        console.warn('清除初始化锁失败:', lockError);
      }
    }
  }

  /**
   * 查找或创建知识库（确保唯一性）
   */
  private static async findOrCreateKnowledgeBase(sampleKB: SampleKnowledgeBase): Promise<any> {
    // 先尝试精确匹配
    const existingKBs = await KnowledgeService.getAllKnowledgeBases();
    let knowledgeBase = existingKBs.find(kb => 
      kb.name === sampleKB.name && 
      kb.description === sampleKB.description
    );
    
    if (knowledgeBase) {
      console.log(`⚠️ 知识库 "${sampleKB.name}" 已存在 (ID: ${knowledgeBase.id})，跳过创建`);
      return knowledgeBase;
    }

    // 检查是否有同名但不同描述的知识库
    const sameNameKB = existingKBs.find(kb => kb.name === sampleKB.name);
    if (sameNameKB) {
      console.log(`⚠️ 发现同名知识库 "${sampleKB.name}" 但描述不同，更新描述`);
      return await KnowledgeService.updateKnowledgeBase(sameNameKB.id, {
        description: sampleKB.description,
        icon: sampleKB.icon
      });
    }

    // 创建新的知识库
    console.log(`📂 创建知识库: ${sampleKB.name}`);
    knowledgeBase = await KnowledgeService.createKnowledgeBase(
      sampleKB.name,
      sampleKB.description,
      sampleKB.icon,
      sampleKB.isEncrypted
    );
    console.log(`知识库创建完成: ${sampleKB.name} (ID: ${knowledgeBase.id})`);
    return knowledgeBase;
  }

  /**
   * 查找或创建示例文档（确保唯一性）
   */
  private static async findOrCreateSampleDocument(sampleDoc: SampleDocument, kbName: string): Promise<any> {
    console.log(`📄 检查示例文档: ${sampleDoc.title}`);
    
    try {
      const { UnifiedFileService } = await import('./unifiedFileService');
      
      // 检查文档是否已存在（精确匹配）
      const existingFiles = await UnifiedFileService.getAllFiles();
      const existingDoc = existingFiles.find(file => 
        file.name === sampleDoc.title && 
        file.source === 'sample' &&
        file.note?.includes(kbName)
      );
      
      if (existingDoc) {
        console.log(`⚠️ 示例文档 "${sampleDoc.title}" 已存在 (ID: ${existingDoc.id})，跳过创建`);
        return existingDoc;
      }

      // 检查是否有同名文档（可能来自其他来源）
      const sameNameDoc = existingFiles.find(file => file.name === sampleDoc.title);
      if (sameNameDoc && sameNameDoc.source !== 'sample') {
        console.log(`⚠️ 发现同名文档 "${sampleDoc.title}" 但来源不同 (${sameNameDoc.source})，添加示例后缀`);
        sampleDoc.title = `${sampleDoc.title} (示例)`;
      }

      // 创建新的示例文档
      console.log(`📄 创建示例文档: ${sampleDoc.title}`);
      const content = new TextEncoder().encode(sampleDoc.content);
      
      const savedFile = await UnifiedFileService.saveFile(
        content,
        sampleDoc.title,
        'sample', // 标记为示例文档
        {
          tags: sampleDoc.tags || ['示例文档', '咖啡文化'],
          note: `示例文档，来自知识库: ${kbName}`
        }
      );
      
      console.log(`示例文档已保存到统一文件系统: ${savedFile.name} (ID: ${savedFile.id})`);
      return savedFile;
      
    } catch (fileError) {
      console.error(`❌ 处理示例文档失败: ${sampleDoc.title}`, fileError);
      throw fileError;
    }
  }

  /**
   * 清理重复的文档
   */
  private static async cleanupDuplicateDocuments(): Promise<void> {
    try {
      console.log('🧹 清理重复的示例文档...');
      const { UnifiedFileService } = await import('./unifiedFileService');
      
      const allFiles = await UnifiedFileService.getAllFiles();
      const sampleFiles = allFiles.filter(file => file.source === 'sample');
      
      // 按文件名分组
      const groupedByName = new Map<string, typeof sampleFiles>();
      
      for (const file of sampleFiles) {
        if (!groupedByName.has(file.name)) {
          groupedByName.set(file.name, []);
        }
        groupedByName.get(file.name)!.push(file);
      }

      // 删除重复项
      for (const [name, files] of groupedByName.entries()) {
        if (files.length > 1) {
          console.log(`发现重复示例文档 "${name}": ${files.length} 个`);
          
          // 按创建时间排序，保留最早的
          files.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          const keepFile = files[0];
          const duplicates = files.slice(1);

          console.log(`保留最早的文档: ${keepFile.name} (ID: ${keepFile.id})`);

          // 删除重复项
          for (const duplicate of duplicates) {
            try {
              await UnifiedFileService.deleteFile(duplicate.id);
              console.log(`已删除重复文档: ${duplicate.id}`);
            } catch (deleteError) {
              console.error(`❌ 删除重复文档失败: ${duplicate.id}`, deleteError);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('清理重复文档失败:', error);
      // 不抛出错误，继续初始化过程
    }
  }

  /**
   * 生成内容哈希值用于去重
   */
  private static generateContentHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 清理重复的知识库
   * 如果有多个同名知识库，只保留最早创建的那个
   */
  static async cleanupDuplicateKnowledgeBases(): Promise<{
    duplicatesFound: number;
    duplicatesRemoved: number;
    cleanedKnowledgeBases: string[];
  }> {
    const result = {
      duplicatesFound: 0,
      duplicatesRemoved: 0,
      cleanedKnowledgeBases: [] as string[]
    };

    try {
      console.log('🧹 开始清理重复的知识库...');

      // 获取所有知识库
      const allKnowledgeBases = await KnowledgeService.getAllKnowledgeBases();
      console.log(`发现 ${allKnowledgeBases.length} 个知识库`);

      // 按名称分组
      const groupedByName = new Map<string, typeof allKnowledgeBases>();
      
      for (const kb of allKnowledgeBases) {
        if (!groupedByName.has(kb.name)) {
          groupedByName.set(kb.name, []);
        }
        groupedByName.get(kb.name)!.push(kb);
      }

      // 查找并清理重复项
      for (const [name, kbs] of groupedByName.entries()) {
        if (kbs.length > 1) {
          console.log(`发现重复知识库 "${name}": ${kbs.length} 个`);
          result.duplicatesFound += kbs.length - 1;

          // 按创建时间排序，保留最早的
          kbs.sort((a, b) => a.createdAt - b.createdAt);
          const keepKB = kbs[0];
          const duplicates = kbs.slice(1);

          console.log(`保留最早创建的知识库: ${keepKB.name} (ID: ${keepKB.id}, 创建时间: ${new Date(keepKB.createdAt).toLocaleString()})`);

          // 删除重复项
          for (const duplicateKB of duplicates) {
            try {
              console.log(`删除重复知识库: ${duplicateKB.name} (ID: ${duplicateKB.id}, 创建时间: ${new Date(duplicateKB.createdAt).toLocaleString()})`);
              await KnowledgeService.deleteKnowledgeBase(duplicateKB.id);
              result.duplicatesRemoved++;
              console.log(`已删除重复知识库: ${duplicateKB.id}`);
            } catch (deleteError) {
              console.error(`❌ 删除重复知识库失败: ${duplicateKB.id}`, deleteError);
            }
          }

          result.cleanedKnowledgeBases.push(name);
        }
      }

      if (result.duplicatesRemoved > 0) {
        console.log(`🎉 清理完成！删除了 ${result.duplicatesRemoved} 个重复知识库`);
      } else {
        console.log('没有发现重复的知识库');
      }

      return result;

    } catch (error) {
      console.error('清理重复知识库失败:', error);
      throw error;
    }
  }

  /**
   * 验证示例数据的完整性
   */
  static async validateData(): Promise<{
    isValid: boolean;
    issues: string[];
    summary: {
      knowledgeBases: number;
      documents: number;
      emptyKnowledgeBases: number;
    };
  }> {
    const issues: string[] = [];
    let knowledgeBasesFound = 0;
    let documentsFound = 0;
    let emptyKnowledgeBases = 0;

    try {
      // 检查知识库
      const knowledgeBases = await KnowledgeService.getAllKnowledgeBases();
      
      for (const sampleKB of SAMPLE_DATA) {
        const foundKB = knowledgeBases.find(kb => kb.name === sampleKB.name);
        if (foundKB) {
          knowledgeBasesFound++;
          
          // 检查知识库是否为空（这是期望的状态）
          const kbDocuments = await KnowledgeService.getKnowledgeBaseDocuments(foundKB.id);
          if (kbDocuments.length === 0) {
            emptyKnowledgeBases++;
          }
          
          // 检查示例文档是否存在（使用UnifiedFileService）
          for (const sampleDoc of sampleKB.documents) {
            try {
              const { UnifiedFileService } = await import('./unifiedFileService');
              const allDocuments = await UnifiedFileService.getAllFiles();
              const foundDoc = allDocuments.find(file => file.name === sampleDoc.title);
              
              if (foundDoc) {
                documentsFound++;
              } else {
                issues.push(`示例文档 "${sampleDoc.title}" 不存在`);
              }
            } catch (error) {
              issues.push(`检查示例文档失败: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        } else {
          issues.push(`示例知识库 "${sampleKB.name}" 不存在`);
        }
      }

      const expectedKBs = SAMPLE_DATA.length;
      const expectedDocs = SAMPLE_DATA.reduce((sum, kb) => sum + kb.documents.length, 0);

      if (knowledgeBasesFound < expectedKBs) {
        issues.push(`缺少 ${expectedKBs - knowledgeBasesFound} 个示例知识库`);
      }

      if (documentsFound < expectedDocs) {
        issues.push(`缺少 ${expectedDocs - documentsFound} 个示例文档`);
      }

      // 空知识库是期望的状态
      if (emptyKnowledgeBases !== knowledgeBasesFound) {
        issues.push(`有 ${knowledgeBasesFound - emptyKnowledgeBases} 个知识库已包含文档，建议重新初始化`);
      }

      return {
        isValid: issues.length === 0,
        issues,
        summary: {
          knowledgeBases: knowledgeBasesFound,
          documents: documentsFound,
          emptyKnowledgeBases
        }
      };

    } catch (error) {
      issues.push(`验证过程出错: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        isValid: false,
        issues,
        summary: {
          knowledgeBases: knowledgeBasesFound,
          documents: documentsFound,
          emptyKnowledgeBases
        }
      };
    }
  }

  /**
   * 强制清理所有示例数据重复项
   * 这是一个彻底的清理函数，会删除所有可能的重复项
   */
  static async forceCleanupAllDuplicates(
    options: { onProgress?: (step: string, progress: number) => void } = {}
  ): Promise<void> {
    const { onProgress } = options;
    
    console.log('🧹 开始强制清理所有示例数据重复项...');
    onProgress?.('开始强制清理重复数据', 0);

    try {
      // 1. 清理重复的知识库
      onProgress?.('清理重复知识库', 20);
      await this.forceCleanupDuplicateKnowledgeBases();

      // 2. 清理重复的文档
      onProgress?.('清理重复文档', 50);
      await this.forceCleanupDuplicateDocuments();

      // 3. 清理孤立的映射关系
      onProgress?.('清理孤立映射关系', 80);
      await this.cleanupOrphanedMappings();

      onProgress?.('清理完成', 100);
      console.log('强制清理所有重复项完成');

    } catch (error) {
      console.error('❌ 强制清理失败:', error);
      throw error;
    }
  }

  /**
   * 强制清理重复的知识库（更激进的清理策略）
   */
  private static async forceCleanupDuplicateKnowledgeBases(): Promise<void> {
    try {
      const allKBs = await KnowledgeService.getAllKnowledgeBases();
      console.log(`检查 ${allKBs.length} 个知识库中的重复项`);

      // 查找所有可能是示例数据的知识库
      const potentialSampleKBs = allKBs.filter(kb => 
        kb.name.includes('咖啡') || 
        kb.name.includes('Coffee') ||
        kb.description?.includes('咖啡') ||
        kb.description?.includes('Coffee') ||
        Object.keys(this.SAMPLE_DATA_HASHES.knowledgeBases).includes(kb.name)
      );

      console.log(`发现 ${potentialSampleKBs.length} 个可能的示例知识库`);

      // 按名称分组
      const groupedByName = new Map<string, typeof potentialSampleKBs>();
      for (const kb of potentialSampleKBs) {
        if (!groupedByName.has(kb.name)) {
          groupedByName.set(kb.name, []);
        }
        groupedByName.get(kb.name)!.push(kb);
      }

      // 删除重复项，只保留最早的
      for (const [name, kbs] of groupedByName.entries()) {
        if (kbs.length > 1) {
          console.log(`发现重复知识库 "${name}": ${kbs.length} 个`);
          
          // 按创建时间排序，保留最早的
          kbs.sort((a, b) => a.createdAt - b.createdAt);
          const keepKB = kbs[0];
          const duplicates = kbs.slice(1);

          console.log(`保留: ${keepKB.name} (${new Date(keepKB.createdAt).toLocaleString()})`);

          // 删除重复项
          for (const duplicate of duplicates) {
            try {
              console.log(`删除重复知识库: ${duplicate.id}`);
              await KnowledgeService.deleteKnowledgeBase(duplicate.id);
            } catch (deleteError) {
              console.error(`删除知识库失败 ${duplicate.id}:`, deleteError);
            }
          }
        }
      }

    } catch (error) {
      console.error('强制清理重复知识库失败:', error);
      throw error;
    }
  }

  /**
   * 强制清理重复的文档（更激进的清理策略）
   */
  private static async forceCleanupDuplicateDocuments(): Promise<void> {
    try {
      const { UnifiedFileService } = await import('./unifiedFileService');
      const allFiles = await UnifiedFileService.getAllFiles();
      
      console.log(`检查 ${allFiles.length} 个文件中的重复项`);

      // 查找所有可能是示例数据的文档
      const potentialSampleDocs = allFiles.filter(file => 
        file.source === 'sample' ||
        file.name.includes('咖啡') ||
        file.name.includes('Coffee') ||
        Object.keys(this.SAMPLE_DATA_HASHES.documents).includes(file.name) ||
        file.tags?.some(tag => ['示例文档', '咖啡文化'].includes(tag))
      );

      console.log(`发现 ${potentialSampleDocs.length} 个可能的示例文档`);

      // 按名称分组
      const groupedByName = new Map<string, typeof potentialSampleDocs>();
      for (const file of potentialSampleDocs) {
        if (!groupedByName.has(file.name)) {
          groupedByName.set(file.name, []);
        }
        groupedByName.get(file.name)!.push(file);
      }

      // 删除重复项，只保留最早的
      for (const [name, files] of groupedByName.entries()) {
        if (files.length > 1) {
          console.log(`发现重复文档 "${name}": ${files.length} 个`);
          
          // 按创建时间排序，保留最早的
          files.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          const keepFile = files[0];
          const duplicates = files.slice(1);

          console.log(`保留: ${keepFile.name} (${keepFile.createdAt})`);

          // 删除重复项
          for (const duplicate of duplicates) {
            try {
              console.log(`删除重复文档: ${duplicate.id}`);
              await UnifiedFileService.deleteFile(duplicate.id);
            } catch (deleteError) {
              console.error(`删除文档失败 ${duplicate.id}:`, deleteError);
            }
          }
        }
      }

    } catch (error) {
      console.error('强制清理重复文档失败:', error);
      throw error;
    }
  }

  /**
   * 清理孤立的映射关系
   */
  private static async cleanupOrphanedMappings(): Promise<void> {
    try {
      // 使用共享的数据库服务，而不是创建独立连接
      const { DatabaseService } = await import('./database/services/DatabaseService');
      const dbService = DatabaseService.getInstance();
      const dbManager = dbService.getDbManager();
      
      // 删除指向不存在知识库或文档的映射
      await dbManager.execute(`
        DELETE FROM doc_knowledge_mappings 
        WHERE knowledge_base_id NOT IN (SELECT id FROM knowledge_bases)
           OR document_id NOT IN (SELECT id FROM documents)
      `);
      
      console.log('清理孤立映射关系完成');
      
    } catch (error) {
      console.error('清理孤立映射关系失败:', error);
    }
  }

  /**
   * 使用内容哈希检查知识库是否已存在
   */
  private static async checkKnowledgeBaseExists(sampleKB: SampleKnowledgeBase): Promise<any | null> {
    const expectedHash = this.SAMPLE_DATA_HASHES.knowledgeBases[sampleKB.name];
    if (!expectedHash) {
      console.warn(`未找到知识库 "${sampleKB.name}" 的预期哈希值`);
      return null;
    }

    try {
      const allKBs = await KnowledgeService.getAllKnowledgeBases();
      
      // 精确匹配：名称 + 描述 + 哈希验证
      const exactMatch = allKBs.find(kb => 
        kb.name === sampleKB.name && 
        kb.description === sampleKB.description
      );

      if (exactMatch) {
        // 进一步验证这是我们期望的示例知识库
        console.log(`发现精确匹配的知识库: ${sampleKB.name} (ID: ${exactMatch.id})`);
        return exactMatch;
      }

      // 检查是否有同名但不同内容的知识库
      const sameNameKB = allKBs.find(kb => kb.name === sampleKB.name);
      if (sameNameKB) {
        console.warn(`⚠️ 发现同名但内容不同的知识库: ${sampleKB.name}，需要清理`);
        return null; // 返回null强制重新创建
      }

      return null; // 未找到匹配的知识库
      
    } catch (error) {
      console.error(`检查知识库存在性失败: ${sampleKB.name}`, error);
      return null;
    }
  }

  /**
   * 使用内容哈希检查文档是否已存在
   */
  private static async checkDocumentExists(sampleDoc: SampleDocument, kbName: string): Promise<any | null> {
    const expectedHash = this.SAMPLE_DATA_HASHES.documents[sampleDoc.title];
    if (!expectedHash) {
      console.warn(`未找到文档 "${sampleDoc.title}" 的预期哈希值`);
      return null;
    }

    try {
      const { UnifiedFileService } = await import('./unifiedFileService');
      const allFiles = await UnifiedFileService.getAllFiles();
      
      // 精确匹配：名称 + 来源 + 内容哈希验证
      const exactMatch = allFiles.find(file => 
        file.name === sampleDoc.title && 
        file.source === 'sample' &&
        file.note?.includes(kbName)
      );

      if (exactMatch) {
        console.log(`发现精确匹配的文档: ${sampleDoc.title} (ID: ${exactMatch.id})`);
        return exactMatch;
      }

      // 检查是否有同名但不同属性的文档
      const sameNameDoc = allFiles.find(file => file.name === sampleDoc.title);
      if (sameNameDoc && sameNameDoc.source !== 'sample') {
        console.warn(`⚠️ 发现同名但来源不同的文档: ${sampleDoc.title}，将使用不同名称`);
        return null;
      }

      return null; // 未找到匹配的文档
      
    } catch (error) {
      console.error(`检查文档存在性失败: ${sampleDoc.title}`, error);
      return null;
    }
  }

  /**
   * 安全创建知识库（避免重复）
   */
  private static async createKnowledgeBaseSafely(sampleKB: SampleKnowledgeBase): Promise<any> {
    try {
      // 最后一次检查
      const existing = await this.checkKnowledgeBaseExists(sampleKB);
      if (existing) {
        console.log(`知识库已存在，跳过创建: ${sampleKB.name}`);
        return existing;
      }

      console.log(`📂 安全创建知识库: ${sampleKB.name}`);
      const knowledgeBase = await KnowledgeService.createKnowledgeBase(
        sampleKB.name,
        sampleKB.description,
        sampleKB.icon,
        sampleKB.isEncrypted
      );
      
      console.log(`知识库创建完成: ${sampleKB.name} (ID: ${knowledgeBase.id})`);
      return knowledgeBase;
      
    } catch (error) {
      console.error(`创建知识库失败: ${sampleKB.name}`, error);
      throw error;
    }
  }

  /**
   * 安全创建文档（避免重复）
   */
  private static async createDocumentSafely(sampleDoc: SampleDocument, kbName: string): Promise<any> {
    try {
      // 最后一次检查
      const existing = await this.checkDocumentExists(sampleDoc, kbName);
      if (existing) {
        console.log(`文档已存在，跳过创建: ${sampleDoc.title}`);
        return existing;
      }

      console.log(`📄 安全创建文档: ${sampleDoc.title}`);
      const { UnifiedFileService } = await import('./unifiedFileService');
      const content = new TextEncoder().encode(sampleDoc.content);
      
      const savedFile = await UnifiedFileService.saveFile(
        content,
        sampleDoc.title,
        'sample',
        {
          tags: sampleDoc.tags || ['示例文档', '咖啡文化'],
          note: `示例文档，来自知识库: ${kbName}`
        }
      );
      
      console.log(`文档创建完成: ${savedFile.name} (ID: ${savedFile.id})`);
      return savedFile;
      
    } catch (error) {
      console.error(`创建文档失败: ${sampleDoc.title}`, error);
      throw error;
    }
  }
}

/**
 * 便捷函数：初始化示例数据（如果需要）
 */
export async function initializeSampleDataIfNeeded(
  onProgress?: (step: string, progress: number) => void
): Promise<void> {
  if (await SampleDataInitializer.isInitialized()) {
    console.log('示例数据已存在，跳过初始化');
    onProgress?.('示例数据已存在', 100);
    return;
  }

  await SampleDataInitializer.initializeAll({ onProgress });
}

/**
 * 便捷函数：重新初始化示例数据
 */
export async function reinitializeSampleData(
  onProgress?: (step: string, progress: number) => void
): Promise<void> {
  await SampleDataInitializer.resetInitialization();
  await SampleDataInitializer.initializeAll({ 
    onProgress, 
    overrideExisting: true 
  });
}

/**
 * 便捷函数：清理重复的知识库
 */
export async function cleanupDuplicateKnowledgeBases(): Promise<{
  duplicatesFound: number;
  duplicatesRemoved: number;
  cleanedKnowledgeBases: string[];
}> {
  return await SampleDataInitializer.cleanupDuplicateKnowledgeBases();
}

/**
 * 便捷函数：清理重复的示例文档
 */
export async function cleanupDuplicateDocuments(): Promise<void> {
  // @ts-ignore - 调用私有方法
  return SampleDataInitializer.cleanupDuplicateDocuments();
} 