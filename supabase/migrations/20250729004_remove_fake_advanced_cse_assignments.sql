-- Remove ALL placeholder/fake assignments with generic "Advanced CSE Course" titles
-- These are seed/test data, not real courses
-- Total: 53 fake assignments across all teachers
delete from public.teacher_assignments
where course_title ilike 'Advanced CSE Course%';