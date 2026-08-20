import 'dotenv/config';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as bcrypt from 'bcrypt';
import {
  AUTH_METHOD,
  LoginChannel,
  PrismaClient,
} from '../generated/prisma/client';
import constructionRates from './data/construction-rates.json';
import valuationOptions from './data/valuation-options.json';

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
  {
    resource: 'valuation',
    actions: ['create', 'read', 'update', 'submit', 'review', 'download'],
  },
  {
    resource: 'case',
    actions: ['create', 'read', 'update', 'assign'],
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

/**
 * Govt. construction rates and dropdown master data, generated from the
 * valuation workbook's hidden reference sheets by
 * `scripts/generate-valuation-seed.ts`. Re-run that script when the book is
 * revised, then re-seed.
 */
async function seedConstructionRates(prisma: PrismaClient) {
  for (const rate of constructionRates) {
    await prisma.constructionRate.upsert({
      where: {
        tehsil_roofType_category: {
          tehsil: rate.tehsil,
          roofType: rate.roofType,
          category: rate.category,
        },
      },
      update: { rate: rate.rate },
      create: rate,
    });
  }
}

async function seedValuationOptions(prisma: PrismaClient) {
  for (const option of valuationOptions) {
    await prisma.valuationOption.upsert({
      where: {
        group_value: { group: option.group, value: option.value },
      },
      update: { sortOrder: option.sortOrder, isActive: true },
      create: option,
    });
  }
}

/** Maps each seeded bank to the report layout its PDF is rendered from. */
async function seedReportTemplates(prisma: PrismaClient) {
  const institutions = await prisma.institution.findMany();

  for (const institution of institutions) {
    const templateKey = institution.code === 'CANARA' ? 'canara' : 'canara';
    await prisma.bankReportTemplate.upsert({
      where: { institutionId: institution.id },
      update: {},
      create: { institutionId: institution.id, templateKey },
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

    console.log(`Seeding ${constructionRates.length} construction rates...`);
    await seedConstructionRates(prisma);

    console.log(`Seeding ${valuationOptions.length} valuation options...`);
    await seedValuationOptions(prisma);

    console.log('Seeding bank report templates...');
    await seedReportTemplates(prisma);

    console.log('Seed completed successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
