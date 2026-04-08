// Input mask utilities for Brazilian formats

export const masks = {
  cnpj: (value: string): string => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  },

  cpf: (value: string): string => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
      .slice(0, 14);
  },

  cpfOrCnpj: (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 11) {
      return masks.cpf(value);
    }
    return masks.cnpj(value);
  },

  phone: (value: string): string => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 14);
  },

  cellphone: (value: string): string => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15);
  },

  cep: (value: string): string => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{5})(\d)/, '$1-$2')
      .slice(0, 9);
  },

  // Remove mask to get only digits
  unmask: (value: string): string => {
    return value.replace(/\D/g, '');
  },
};

// Validation utilities
export const validators = {
  cnpj: (cnpj: string): boolean => {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return false;
    
    // Check for known invalid patterns
    if (/^(\d)\1+$/.test(digits)) return false;
    
    // CNPJ validation algorithm
    let sum = 0;
    let weight = 5;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(digits[i]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    let remainder = sum % 11;
    const firstDigit = remainder < 2 ? 0 : 11 - remainder;
    
    if (parseInt(digits[12]) !== firstDigit) return false;
    
    sum = 0;
    weight = 6;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(digits[i]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    remainder = sum % 11;
    const secondDigit = remainder < 2 ? 0 : 11 - remainder;
    
    return parseInt(digits[13]) === secondDigit;
  },

  cpf: (cpf: string): boolean => {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return false;
    
    // Check for known invalid patterns
    if (/^(\d)\1+$/.test(digits)) return false;
    
    // CPF validation algorithm
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(digits[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    const firstDigit = remainder === 10 ? 0 : remainder;
    
    if (parseInt(digits[9]) !== firstDigit) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(digits[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    const secondDigit = remainder === 10 ? 0 : remainder;
    
    return parseInt(digits[10]) === secondDigit;
  },

  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  cep: (cep: string): boolean => {
    const digits = cep.replace(/\D/g, '');
    return digits.length === 8;
  },
};
