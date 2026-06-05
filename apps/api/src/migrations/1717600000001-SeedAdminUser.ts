import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedAdminUser1717600000001 implements MigrationInterface {
  name = 'SeedAdminUser1717600000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const email = process.env.ADMIN_DEFAULT_EMAIL ?? 'admin@payduka.xyz';
    const password = process.env.ADMIN_DEFAULT_PASSWORD ?? 'change-me';
    const hash = await bcrypt.hash(password, 12);

    await queryRunner.query(`
      INSERT INTO admin_users (email, password_hash, name, role)
      VALUES ($1, $2, 'System Admin', 'SUPER_ADMIN')
      ON CONFLICT (email) DO NOTHING
    `, [email, hash]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const email = process.env.ADMIN_DEFAULT_EMAIL ?? 'admin@payduka.xyz';
    await queryRunner.query(`DELETE FROM admin_users WHERE email = $1`, [email]);
  }
}
