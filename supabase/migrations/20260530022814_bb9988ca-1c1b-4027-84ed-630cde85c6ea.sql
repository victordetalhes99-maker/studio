UPDATE auth.users
SET encrypted_password = crypt('deusefiel', gen_salt('bf')),
    updated_at = now()
WHERE id IN (SELECT user_id FROM public.admins);