-- Seed: 6 pillar rows (run after migrations)
INSERT INTO public.pillars (slug, domain, label, description, sort_order) VALUES
  ('body',      'health', 'Body',      'Physical fitness, body composition, and athletic performance', 1),
  ('mind',      'health', 'Mind',      'Mental clarity, focus, learning, and cognitive performance',  2),
  ('spirit',    'health', 'Spirit',    'Emotional health, purpose, meditation, and inner peace',      3),
  ('structure', 'wealth', 'Structure', 'Daily systems, habits, planning, and productive routines',    4),
  ('leverage',  'wealth', 'Leverage',  'Skills, income streams, investments, and asset building',     5),
  ('agency',    'wealth', 'Agency',    'Decision-making, freedom, relationships, and social capital', 6)
ON CONFLICT (slug) DO NOTHING;
