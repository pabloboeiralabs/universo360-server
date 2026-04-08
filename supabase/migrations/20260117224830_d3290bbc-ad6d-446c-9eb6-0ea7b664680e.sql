-- Adicionar campo username na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Criar índice para busca rápida por username
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Atualizar o admin existente com username 'admin'
UPDATE profiles 
SET username = 'admin' 
WHERE id = 'c9344362-6640-4136-a67c-45a981b05974';