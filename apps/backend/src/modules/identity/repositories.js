import { BaseMongoRepository } from '../../repositories/BaseMongoRepository.js';

export class RoleRepository extends BaseMongoRepository {
  constructor() {
    super('roles', 'role');
  }

  async findByCode(code) {
    if (!code) return null;
    return this.findOne({ code: String(code).trim().toUpperCase() });
  }

  async findByIds(roleIds = []) {
    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      return [];
    }
    return this.findMany({ _id: { $in: roleIds.map(String) } });
  }

  async findAllActive() {
    return this.findMany({}, { sort: [['name', 1]] });
  }
}

export class UserRepository extends BaseMongoRepository {
  constructor() {
    super('users', 'usr');
  }

  async findByUsername(username) {
    if (!username) return null;
    return this.findOne({ username: String(username).trim().toLowerCase() });
  }

  async findSafeById(userId) {
    const doc = await this.findById(userId);
    return UserRepository.sanitizeUser(doc);
  }

  static sanitizeUser(userDoc) {
    if (!userDoc) return null;
    const safe = { ...userDoc };
    delete safe.passwordHash;
    return safe;
  }
}

export const roleRepository = new RoleRepository();
export const userRepository = new UserRepository();
