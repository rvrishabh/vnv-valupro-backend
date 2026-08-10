import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as bcrypt from 'bcrypt';
import {
  AUTH_METHOD,
  LoginChannel,
  PrismaClient,
} from '../generated/prisma/client';

const SALT_ROUNDS = 10;

const SYSTEM_ROLES = [
  {
    name: 'ADMIN',
    description: 'Bootstrap web portal administrator',
    loginChannel: LoginChannel.WEB,
    isSystem: true,
  },
  {
    name: 'BANK_MANAGER',
    description: 'Bank manager mobile app user',
    loginChannel: LoginChannel.MOBILE,
    isSystem: true,
  },
  {
    name: 'SITE_ENGINEER',
    description: 'Site engineer mobile app user',
    loginChannel: LoginChannel.MOBILE,
    isSystem: true,
  },
] as const;

const MODULE_PERMISSIONS = [
  {
    resource: 'institution_type',
    actions: ['create', 'read', 'update', 'delete'],
  },
  {
    resource: 'institution',
    actions: ['create', 'read', 'update', 'delete'],
  },
  {
    resource: 'branch',
    actions: ['create', 'read', 'update', 'delete', 'verify'],
  },
  {
    resource: 'role',
    actions: ['create', 'read', 'update', 'delete', 'manage_permissions'],
  },
  {
    resource: 'permission',
    actions: ['create', 'read', 'update', 'delete'],
  },
  {
    resource: 'user',
    actions: [
      'create',
      'read',
      'update',
      'approve',
      'deactivate',
      'assign_branch',
    ],
  },
  {
    resource: 'valuation_estimate',
    actions: ['create', 'read'],
  },
] as const;

const INDIAN_BANKS = [
  { name: 'State Bank of India', code: 'SBI' },
  { name: 'HDFC Bank', code: 'HDFC' },
  { name: 'ICICI Bank', code: 'ICICI' },
  { name: 'Axis Bank', code: 'AXIS' },
  { name: 'Kotak Mahindra Bank', code: 'KOTAK' },
  { name: 'Punjab National Bank', code: 'PNB' },
  { name: 'Bank of Baroda', code: 'BOB' },
  { name: 'Canara Bank', code: 'CANARA' },
  { name: 'Union Bank of India', code: 'UNION' },
  { name: 'Bank of India', code: 'BOI' },
] as const;

function createPrismaClient() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set');
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

async function seedRoles(prisma: PrismaClient) {
  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        loginChannel: role.loginChannel,
        isSystem: role.isSystem,
      },
      create: role,
    });
  }
}

function toPermissionName(resource: string, action: string) {
  return `${resource}_${action}`.toUpperCase();
}

async function seedPermissions(prisma: PrismaClient) {
  for (const module of MODULE_PERMISSIONS) {
    for (const action of module.actions) {
      const name = toPermissionName(module.resource, action);
      await prisma.permission.upsert({
        where: { resource_action: { resource: module.resource, action } },
        update: { name },
        create: {
          name,
          resource: module.resource,
          action,
        },
      });
    }
  }
}

async function seedAdminRolePermissions(prisma: PrismaClient) {
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  if (!adminRole) {
    throw new Error('ADMIN role not found — seed roles first');
  }

  const permissions = await prisma.permission.findMany({
    select: { id: true },
  });

  await prisma.rolePermission.createMany({
    data: permissions.map(({ id }) => ({
      roleId: adminRole.id,
      permissionId: id,
    })),
    skipDuplicates: true,
  });
}

async function seedInstitutionTypeAndBanks(prisma: PrismaClient) {
  const bankType = await prisma.institutionType.upsert({
    where: { name: 'Bank' },
    update: {},
    create: {
      name: 'Bank',
      description: 'Scheduled commercial banks regulated by RBI',
    },
  });

  for (const bank of INDIAN_BANKS) {
    await prisma.institution.upsert({
      where: { code: bank.code },
      update: {
        name: bank.name,
        isActive: true,
        institutionTypeId: bankType.id,
      },
      create: {
        name: bank.name,
        code: bank.code,
        isActive: true,
        institutionTypeId: bankType.id,
      },
    });
  }
}

async function seedAdminUser(prisma: PrismaClient) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  }

  const adminRole = await prisma.role.findUnique({
    where: { name: 'ADMIN' },
  });
  if (!adminRole) {
    throw new Error('ADMIN role not found — seed roles first');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Admin',
      passwordHash,
      authMethod: AUTH_METHOD.PASSWORD,
      isApproved: true,
      isActive: true,
      roleId: adminRole.id,
    },
    create: {
      name: 'Admin',
      email,
      passwordHash,
      authMethod: AUTH_METHOD.PASSWORD,
      isApproved: true,
      isActive: true,
      role: { connect: { id: adminRole.id } },
    },
  });
}

const VALUATION_CONFIGS = [
  {
    key: 'MUMTY_THRESHOLD_SQFT',
    value: '162',
    description:
      'Minimum area in sq ft below which a floor is classified as Mumty instead of a full floor',
  },
  {
    key: 'MAX_PLOT_SQM',
    value: '2000',
    description:
      'Maximum supported plot area in sq meters for coverage bracket lookup',
  },
] as const;

async function seedValuationConfig(prisma: PrismaClient) {
  for (const config of VALUATION_CONFIGS) {
    await prisma.valuationConfig.upsert({
      where: { key: config.key },
      update: {
        value: config.value,
        description: config.description,
      },
      create: config,
    });
  }
}

async function main() {
  const prisma = createPrismaClient();

  try {
    console.log('Seeding system roles...');
    await seedRoles(prisma);

    console.log('Seeding permissions...');
    await seedPermissions(prisma);

    console.log('Assigning permissions to ADMIN role...');
    await seedAdminRolePermissions(prisma);

    console.log('Seeding institution type and banks...');
    await seedInstitutionTypeAndBanks(prisma);

    console.log('Seeding admin user...');
    await seedAdminUser(prisma);

    console.log('Seeding valuation config...');
    await seedValuationConfig(prisma);

    console.log('Seed completed successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
