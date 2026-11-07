import { STORAGE_KEYS } from '../../../constants/storageKeys.js';
import { storageAdapter } from '../../storage/localStorageAdapter.js';
import { auditRepository } from '../auditRepository.js';

class CategoryLocalRepository {
  async getCategories(includeInactive = false) {
    const categories = storageAdapter.getItem(STORAGE_KEYS.CATEGORIES) || [];
    const list = categories.filter((c) => !c.isDeleted && (includeInactive ? true : c.isActive !== false));
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
      kotRequired: categoryData.kotRequired !== undefined ? Boolean(categoryData.kotRequired) : true,
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
      isActive: categoryData.isActive !== undefined ? Boolean(categoryData.isActive) : categories[index].isActive,
      kotRequired: categoryData.kotRequired !== undefined ? Boolean(categoryData.kotRequired) : (categories[index].kotRequired !== false),
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
    const categories = storageAdapter.getItem(STORAGE_KEYS.CATEGORIES) || [];
    const index = categories.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error('Category not found.');
    }

    const willBeActive = !categories[index].isActive;
    categories[index].isActive = willBeActive;
    if (!willBeActive) {
      categories[index].isDeleted = true;
      categories[index].deletedAt = new Date().toISOString();
    }
    categories[index].updatedAt = new Date().toISOString();
    storageAdapter.setItem(STORAGE_KEYS.CATEGORIES, categories);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: willBeActive ? 'CATEGORY_ACTIVATED' : 'CATEGORY_DEACTIVATED',
      entityType: 'Category',
      entityId: id,
      details: `Category "${categories[index].name}" was ${willBeActive ? 'activated' : 'soft deleted'}.`
    });

    return categories[index];
  }

  async deleteCategory(id, actor = { id: 'admin', name: 'Admin' }) {
    const categories = storageAdapter.getItem(STORAGE_KEYS.CATEGORIES) || [];
    const index = categories.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error('Category not found.');
    }
    const catName = categories[index].name;

    const products = storageAdapter.getItem(STORAGE_KEYS.PRODUCTS) || [];
    const productCount = products.filter((p) => p.categoryId === id && !p.isDeleted).length;
    if (productCount > 0) {
      throw new Error(`Cannot delete category "${catName}" because ${productCount} active product(s) are assigned to it.`);
    }

    categories[index].isDeleted = true;
    categories[index].deletedAt = new Date().toISOString();
    categories[index].isActive = false;
    storageAdapter.setItem(STORAGE_KEYS.CATEGORIES, categories);

    await auditRepository.logEvent({
      actorId: actor.id,
      actorName: actor.name,
      action: 'CATEGORY_DELETED',
      entityType: 'Category',
      entityId: id,
      details: `Soft deleted category "${catName}".`
    });

    return { success: true, id };
  }
}

export const categoryLocalRepository = new CategoryLocalRepository();
