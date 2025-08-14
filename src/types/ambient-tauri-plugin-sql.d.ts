// Ambient type override for @tauri-apps/plugin-sql to provide typed select<T>()
// so that db.select returns T[] instead of unknown, aligning local builds with CI.
declare module '@tauri-apps/plugin-sql' {
  export default class Database {
    static load(url: string): Promise<Database>;
    /** Execute a non-returning SQL statement. */
    execute(sql: string, params?: any[]): Promise<any>;
    /** Execute a query and return typed rows. */
    select<T = any>(sql: string, params?: any[]): Promise<T[]>;
    /** Close the database connection. */
    close(): Promise<void>;
  }
}


