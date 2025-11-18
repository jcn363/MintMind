/**
 * Tests para módulos TypeScript con ES modules
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Interfaces para testing
interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

interface UserService {
  createUser(userData: Omit<User, 'id'>): Promise<User>;
  getUserById(id: number): Promise<User | null>;
  updateUser(id: number, updates: Partial<User>): Promise<User | null>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
}

// Implementación mock del servicio de usuarios
class MockUserService implements UserService {
  private users: User[] = [];
  private nextId = 1;

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = {
      id: this.nextId++,
      ...userData,
    };
    this.users.push(user);
    return user;
  }

  async getUserById(id: number): Promise<User | null> {
    return this.users.find(user => user.id === id) || null;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
    const index = this.users.findIndex(user => user.id === id);
    if (index === -1) return null;

    this.users[index] = { ...this.users[index], ...updates };
    return this.users[index];
  }

  async deleteUser(id: number): Promise<boolean> {
    const index = this.users.findIndex(user => user.id === id);
    if (index === -1) return false;

    this.users.splice(index, 1);
    return true;
  }

  async getAllUsers(): Promise<User[]> {
    return [...this.users];
  }
}

// Servicio de validación
class ValidationService {
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateUserName(name: string): boolean {
    return name.length >= 2 && name.length <= 50 && /^[\p{L}\s]+$/u.test(name);
  }

  static validateUserData(userData: Omit<User, 'id'>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.validateUserName(userData.name)) {
      errors.push('Name must be 2-50 characters and contain only letters and spaces');
    }

    if (!this.validateEmail(userData.email)) {
      errors.push('Invalid email format');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Tests para ValidationService
describe('ValidationService', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(ValidationService.validateEmail('test@example.com')).toBe(true);
      expect(ValidationService.validateEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(ValidationService.validateEmail('123@test-domain.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(ValidationService.validateEmail('invalid-email')).toBe(false);
      expect(ValidationService.validateEmail('@example.com')).toBe(false);
      expect(ValidationService.validateEmail('test@')).toBe(false);
      expect(ValidationService.validateEmail('')).toBe(false);
    });
  });

  describe('validateUserName', () => {
    it('should validate correct names', () => {
      expect(ValidationService.validateUserName('John Doe')).toBe(true);
      expect(ValidationService.validateUserName('Jane')).toBe(true);
      expect(ValidationService.validateUserName('José María')).toBe(true);
    });

    it('should reject invalid names', () => {
      expect(ValidationService.validateUserName('J')).toBe(false); // Too short
      expect(ValidationService.validateUserName('A'.repeat(51))).toBe(false); // Too long
      expect(ValidationService.validateUserName('John123')).toBe(false); // Contains numbers
      expect(ValidationService.validateUserName('John@Doe')).toBe(false); // Contains special chars
      expect(ValidationService.validateUserName('')).toBe(false); // Empty
    });
  });

  describe('validateUserData', () => {
    it('should validate correct user data', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        isActive: true,
      };

      const result = ValidationService.validateUserData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should collect multiple validation errors', () => {
      const invalidData = {
        name: 'J',
        email: 'invalid-email',
        isActive: true,
      };

      const result = ValidationService.validateUserData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Name must be 2-50 characters and contain only letters and spaces');
      expect(result.errors).toContain('Invalid email format');
    });
  });
});

// Tests para MockUserService
describe('MockUserService', () => {
  let userService: MockUserService;

  beforeEach(() => {
    userService = new MockUserService();
  });

  afterEach(() => {
    // Limpiar estado después de cada test
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a user with generated ID', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        isActive: true,
      };

      const user = await userService.createUser(userData);

      expect(user).toEqual({
        id: 1,
        ...userData,
      });
      expect(user.id).toBe(1);
    });

    it('should generate sequential IDs', async () => {
      const user1 = await userService.createUser({
        name: 'User 1',
        email: 'user1@example.com',
        isActive: true,
      });

      const user2 = await userService.createUser({
        name: 'User 2',
        email: 'user2@example.com',
        isActive: false,
      });

      expect(user1.id).toBe(1);
      expect(user2.id).toBe(2);
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const createdUser = await userService.createUser({
        name: 'Jane Doe',
        email: 'jane@example.com',
        isActive: true,
      });

      const foundUser = await userService.getUserById(createdUser.id);
      expect(foundUser).toEqual(createdUser);
    });

    it('should return null when user not found', async () => {
      const foundUser = await userService.getUserById(999);
      expect(foundUser).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const createdUser = await userService.createUser({
        name: 'Original Name',
        email: 'original@example.com',
        isActive: true,
      });

      const updates = {
        name: 'Updated Name',
        isActive: false,
      };

      const updatedUser = await userService.updateUser(createdUser.id, updates);

      expect(updatedUser).toEqual({
        ...createdUser,
        ...updates,
      });
    });

    it('should return null when updating non-existent user', async () => {
      const result = await userService.updateUser(999, { name: 'New Name' });
      expect(result).toBeNull();
    });
  });

  describe('deleteUser', () => {
    it('should delete existing user', async () => {
      const createdUser = await userService.createUser({
        name: 'User to Delete',
        email: 'delete@example.com',
        isActive: true,
      });

      const deleted = await userService.deleteUser(createdUser.id);
      expect(deleted).toBe(true);

      const foundUser = await userService.getUserById(createdUser.id);
      expect(foundUser).toBeNull();
    });

    it('should return false when deleting non-existent user', async () => {
      const deleted = await userService.deleteUser(999);
      expect(deleted).toBe(false);
    });
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      const users = [
        { name: 'User 1', email: 'user1@example.com', isActive: true },
        { name: 'User 2', email: 'user2@example.com', isActive: false },
      ];

      await Promise.all(users.map(user => userService.createUser(user)));

      const allUsers = await userService.getAllUsers();
      expect(allUsers).toHaveLength(2);
      expect(allUsers[0].name).toBe('User 1');
      expect(allUsers[1].name).toBe('User 2');
    });

    it('should return empty array when no users exist', async () => {
      const allUsers = await userService.getAllUsers();
      expect(allUsers).toEqual([]);
    });
  });
});

/**
 * Tests para promesas y async/await con ES modules
 */
describe('Async/Await with ES Modules', () => {
  it('should handle Promise.resolve correctly', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  it('should handle Promise rejection', async () => {
    await expect(Promise.reject(new Error('Test error'))).rejects.toThrow('Test error');
  });

  it('should handle multiple async operations', async () => {
    const promises = [
      Promise.resolve(1),
      Promise.resolve(2),
      Promise.resolve(3),
    ];

    const results = await Promise.all(promises);
    expect(results).toEqual([1, 2, 3]);
  });

  it('should handle Promise.allSettled', async () => {
    const promises = [
      Promise.resolve(1),
      Promise.reject(new Error('Failed')),
      Promise.resolve(3),
    ];

    const results = await Promise.allSettled(promises);
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
    expect(results[1]).toEqual({
      status: 'rejected',
      reason: expect.any(Error),
    });
    expect(results[2]).toEqual({ status: 'fulfilled', value: 3 });
  });
});