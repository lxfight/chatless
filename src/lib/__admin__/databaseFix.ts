import Database from "@tauri-apps/plugin-sql";

/**
 * 数据库修复脚本
 * 用于修复缺失的document_reference和context_data字段
 */

export async function fixMessagesTable(db: Database): Promise<void> {
  console.log("开始修复messages表结构...");
  
  try {
    // 检查表结构
    const tableInfo = await db.select("PRAGMA table_info(messages)") as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: any;
      pk: number;
    }>;

    const hasDocumentReference = tableInfo.some(col => col.name === 'document_reference');
    const hasContextData = tableInfo.some(col => col.name === 'context_data');

    console.log(`当前表结构检查: document_reference=${hasDocumentReference}, context_data=${hasContextData}`);

    if (!hasDocumentReference || !hasContextData) {
      console.log("检测到缺失字段，开始修复...");
      
      // 开始事务
      await db.execute("BEGIN TRANSACTION");
      
      try {
        // 添加缺失的字段
        if (!hasDocumentReference) {
          console.log("添加document_reference字段...");
          await db.execute("ALTER TABLE messages ADD COLUMN document_reference TEXT");
        }
        
        if (!hasContextData) {
          console.log("添加context_data字段...");
          await db.execute("ALTER TABLE messages ADD COLUMN context_data TEXT");
        }
        
        // 提交事务
        await db.execute("COMMIT");
        console.log("messages表修复完成");
        
        // 验证修复结果
        const newTableInfo = await db.select("PRAGMA table_info(messages)") as Array<{
          name: string;
          type: string;
        }>;
        
        const columns = newTableInfo.map(col => col.name);
        console.log("修复后的表结构:", columns);
        
      } catch (error) {
        // 回滚事务
        await db.execute("ROLLBACK");
        throw error;
      }
    } else {
      console.log("messages表结构正常，无需修复");
    }
    
  } catch (error) {
    console.error("修复messages表失败:", error);
    throw error;
  }
}

/**
 * 强制重建messages表（如果ALTER TABLE失败）
 */
export async function rebuildMessagesTable(db: Database): Promise<void> {
  console.log("开始重建messages表...");
  
  try {
    // 开始事务
    await db.execute("BEGIN TRANSACTION");
    
    // 检查旧表是否存在数据
    const hasData = await db.select("SELECT COUNT(*) as count FROM messages");
    const dataCount = (hasData as any)[0]?.count || 0;
    
    console.log(`发现 ${dataCount} 条消息记录`);
    
    // 创建新表
    await db.execute(`
      CREATE TABLE messages_new (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        model TEXT,
        document_reference TEXT,
        context_data TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `);
    
    // 迁移现有数据
    if (dataCount > 0) {
      console.log("迁移现有数据...");
      
      // 获取旧表结构
      const oldTableInfo = await db.select("PRAGMA table_info(messages)") as Array<{
        name: string;
        type: string;
      }>;
      
      const hasOldDocRef = oldTableInfo.some(col => col.name === 'document_reference');
      const hasOldContextData = oldTableInfo.some(col => col.name === 'context_data');
      const hasTimestamp = oldTableInfo.some(col => col.name === 'timestamp');
      
      let insertQuery = '';
      
      if (hasTimestamp) {
        // 从旧的timestamp字段迁移
        insertQuery = `
          INSERT INTO messages_new (id, conversation_id, role, content, created_at, updated_at, status, model, document_reference, context_data)
          SELECT 
            id, 
            conversation_id, 
            role, 
            content,
            CASE 
              WHEN timestamp IS NULL THEN 0
              WHEN typeof(timestamp) = 'integer' THEN timestamp
              ELSE strftime('%s', timestamp) * 1000 
            END as created_at,
            CASE 
              WHEN timestamp IS NULL THEN 0
              WHEN typeof(timestamp) = 'integer' THEN timestamp
              ELSE strftime('%s', timestamp) * 1000 
            END as updated_at,
            COALESCE(status, 'pending'),
            model,
            ${hasOldDocRef ? 'document_reference' : 'NULL'},
            ${hasOldContextData ? 'context_data' : 'NULL'}
          FROM messages
        `;
      } else {
        // 从现有字段迁移
        insertQuery = `
          INSERT INTO messages_new (id, conversation_id, role, content, created_at, updated_at, status, model, document_reference, context_data)
          SELECT 
            id, 
            conversation_id, 
            role, 
            content,
            COALESCE(created_at, 0),
            COALESCE(updated_at, created_at, 0),
            COALESCE(status, 'pending'),
            model,
            ${hasOldDocRef ? 'document_reference' : 'NULL'},
            ${hasOldContextData ? 'context_data' : 'NULL'}
          FROM messages
        `;
      }
      
      await db.execute(insertQuery);
    }
    
    // 删除旧表，重命名新表
    await db.execute("DROP TABLE messages");
    await db.execute("ALTER TABLE messages_new RENAME TO messages");
    
    // 提交事务
    await db.execute("COMMIT");
    
    console.log("messages表重建完成");
    
    // 验证重建结果
    const newTableInfo = await db.select("PRAGMA table_info(messages)") as Array<{
      name: string;
      type: string;
    }>;
    
    const columns = newTableInfo.map(col => col.name);
    console.log("重建后的表结构:", columns);
    
    const newDataCount = await db.select("SELECT COUNT(*) as count FROM messages");
    const newCount = (newDataCount as any)[0]?.count || 0;
    console.log(`重建后的数据记录数: ${newCount}`);
    
  } catch (error) {
    // 回滚事务
    await db.execute("ROLLBACK");
    console.error("重建messages表失败:", error);
    throw error;
  }
} 