import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { auditRepository } from '../auditRepository.js';

class CategoryLocalRepository {
  async getCategories(includeInactive = true) {
    const categories = storageAdapter.getItem(STORAGE_KEYS.CATEGORIES) || [];
    const list = includeInactive ? categories : categories.filter((c) => c.isActive);
    return list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async getCategoryById(id) {
    const categories = await this.getCategories(true);
    return categories.find((c) => c.id === id) || null;
  }

  async createCategory(categoryData, actor = { id: 'admin', name: 'Admin' }) {
    const categories = await this.getCategories(true);

    const exists = categories.some(
      (c) => c.name.toLowerCase() === categoryData.name.trim().toLowerCase()
    );
    if (exists) {
      throw new Error(`Category "${categoryData.name}" already exists.`);
    }

    const newCategory = {
      id: `cat-${Date.now()}`,
      name: categoryData.name.trim(),
      code: categoryData.code?.trim().toUpperCase() || '',
      sortOrder: Number(categoryData.sortOrder) || categories.length + 1,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    categories.push(newCategory);
    storageAdapter.setItem(STORAGE_KEYS.CATEGORIES, categories);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'CATEGORY_CREATED',
      entityType: 'Category',
      entityId: newCategory.id,
      details: `Created menu category "${newCategory.name}".`
    });

    return newCategory;
  }

  async updateCategory(id, categoryData, actor = { id: 'admin', name: 'Admin' }) {
    const categories = await this.getCategories(true);
    const index = categories.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error('Category not found.');
    }

    if (categoryData.name) {
      const duplicate = categories.find(
        (c) => c.id !== id && c.name.toLowerCase() === categoryData.name.trim().toLowerCase()
      );
      if (duplicate) {
        throw new Error(`Category name "${categoryData.name}" is already used.`);
      }
    }

    categories[index] = {
      ...categories[index],
      name: categoryData.name?.trim() || categories[index].name,
      code: categoryData.code !== undefined ? categoryData.code.trim().toUpperCase() : categories[index].code,
      sortOrder: categoryData.sortOrder !== undefined ? Number(categoryData.sortOrder) : categories[index].sortOrder,
      updatedAt: new Date().toISOString()
    };

    storageAdapter.setItem(STORAGE_KEYS.CATEGORIES, categories);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'CATEGORY_UPDATED',
      entityType: 'Category',
      entityId: id,
      details: `Updated category "${categories[index].name}".`
    });

    return categories[index];
  }

  async toggleCategoryStatus(id, actor = { id: 'admin', name: 'Admin' }) {
    const categories = await this.getCategories(true);
    const index = categories.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error('Category not found.');
    }

    categories[index].isActive = !categories[index].isActive;
    categories[index].updatedAt = new Date().toISOString();
    storageAdapter.setItem(STORAGE_KEYS.CATEGORIES, categories);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: categories[index].isActive ? 'CATEGORY_ACTIVATED' : 'CATEGORY_DEACTIVATED',
      entityType: 'Category',
      entityId: id,
      details: `Category "${categories[index].name}" was ${categories[index].isActive ? 'activated' : 'deactivated'}.`
    });

    return categories[index];
  }
}

export const categoryLocalRepository = new CategoryLocalRepository();
