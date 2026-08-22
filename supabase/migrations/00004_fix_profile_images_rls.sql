-- Fix Row-Level Security for Profile Images on public.images table
DROP POLICY IF EXISTS "Group members can view presence images" ON public.images;
DROP POLICY IF EXISTS "Group members can view group images" ON public.images;

CREATE POLICY "Group members can view group images"
ON public.images FOR SELECT
TO authenticated
USING (
  uploaded_by = auth.uid() OR
  EXISTS (
    SELECT 1
    FROM public.presences p
    JOIN public.members m ON m.id = p.member_id
    WHERE p.image_id = public.images.id
      AND public.is_group_member(m.group_id)
  ) OR
  EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.profile_image_id = public.images.id
      AND public.is_group_member(m.group_id)
  )
);