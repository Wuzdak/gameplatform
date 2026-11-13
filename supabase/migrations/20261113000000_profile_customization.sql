-- VEXORA: customizable public player profiles and controlled library visibility.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS name_sticker text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS library_visibility text NOT NULL DEFAULT 'private';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_library_visibility_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_library_visibility_check
  CHECK (library_visibility IN ('public', 'private'));

CREATE OR REPLACE FUNCTION public.get_player_profile_details(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  banner_url text,
  name_sticker text,
  bio text,
  library_visibility text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    COALESCE(p.full_name, 'Игрок'),
    p.avatar_url,
    p.banner_url,
    p.name_sticker,
    p.bio,
    p.library_visibility
  FROM public.profiles AS p
  WHERE p.id = p_user_id
    AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_player_profile_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_profile_details(uuid) TO authenticated;

DROP POLICY IF EXISTS "Public player libraries are visible" ON public.user_library;
CREATE POLICY "Public player libraries are visible"
ON public.user_library
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = user_library.user_id
      AND profile.library_visibility = 'public'
  )
);
