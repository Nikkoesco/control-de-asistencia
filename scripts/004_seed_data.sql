-- Insert sample data for testing
-- Note: This will only work after users are created through the auth system

-- Sample classes (will be inserted by admin users)
INSERT INTO public.classes (name, description) VALUES
  ('Matemáticas 1A', 'Clase de matemáticas para primer año sección A'),
  ('Historia 2B', 'Clase de historia para segundo año sección B'),
  ('Ciencias 3C', 'Clase de ciencias para tercer año sección C')
ON CONFLICT DO NOTHING;

-- Sample students (will be inserted by admin users)
INSERT INTO public.students (name, email, student_id, grade, section) VALUES
  ('Juan Pérez', 'juan.perez@estudiante.edu', 'EST001', '1', 'A'),
  ('María García', 'maria.garcia@estudiante.edu', 'EST002', '1', 'A'),
  ('Carlos López', 'carlos.lopez@estudiante.edu', 'EST003', '2', 'B'),
  ('Ana Martínez', 'ana.martinez@estudiante.edu', 'EST004', '2', 'B'),
  ('Luis Rodríguez', 'luis.rodriguez@estudiante.edu', 'EST005', '3', 'C')
ON CONFLICT (student_id) DO NOTHING;
