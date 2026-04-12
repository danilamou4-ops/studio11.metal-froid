CREATE TABLE IF NOT EXISTS allowed_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  approved boolean DEFAULT false,
  role text DEFAULT 'member', -- 'admin' | 'member'
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz
);

-- Index pour lookup rapide par email
CREATE INDEX IF NOT EXISTS idx_allowed_users_email
  ON allowed_users(email);

-- RLS : lecture autorisée uniquement via service_role (middleware serveur)
ALTER TABLE allowed_users ENABLE ROW LEVEL SECURITY;

-- Insérer l'admin par défaut (remplacer par ton email réel)
INSERT INTO allowed_users (email, approved, role, approved_at)
VALUES ('oggikeens@gmail.com', true, 'admin', now())
ON CONFLICT (email) DO NOTHING;
