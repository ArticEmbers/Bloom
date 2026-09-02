-- Bloom additional global badges. Run after profile-social-features.sql.
insert into public.global_badges (name, description, icon, priority)
values
  ('Developer', 'Built and maintained Bloom.', '🛠️', 80),
  ('Contributor', 'Contributed code, design, or infrastructure to Bloom.', '💻', 70),
  ('Founding Member', 'One of the first members of the Bloom community.', '🌱', 65),
  ('Bug Hunter', 'Helped find and report issues in Bloom.', '🐞', 60),
  ('Artist', 'Shared artwork or visual work with the Bloom community.', '🎨', 55),
  ('VIP', 'A special global Bloom supporter.', '💎', 50),
  ('Community Helper', 'Helped other members and kept the community welcoming.', '🛡️', 45),
  ('Friend of Bloom', 'A special friend of the Bloom project.', '🌸', 40),
  ('Verified', 'A globally verified Bloom account.', '✓', 35),
  ('Staff', 'Trusted Bloom staff member.', '🔧', 34),
  ('Partner', 'A trusted Bloom community partner.', '🤝', 33),
  ('Event Host', 'Hosted or organized a Bloom community event.', '🎉', 30)
on conflict (name) do update set description=excluded.description, icon=excluded.icon, priority=excluded.priority;
