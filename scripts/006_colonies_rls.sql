-- Enable RLS on colonies tables
ALTER TABLE public.colonies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colony_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colony_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_imports ENABLE ROW LEVEL SECURITY;

-- Colonies policies
CREATE POLICY "Users can view colonies they created" ON public.colonies
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create colonies" ON public.colonies
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update colonies they created" ON public.colonies
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete colonies they created" ON public.colonies
  FOR DELETE USING (auth.uid() = created_by);

-- Colony students policies
CREATE POLICY "Users can view students in colonies they created" ON public.colony_students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_students.colony_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can add students to colonies they created" ON public.colony_students
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_students.colony_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update students in colonies they created" ON public.colony_students
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_students.colony_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete students from colonies they created" ON public.colony_students
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_students.colony_id 
      AND created_by = auth.uid()
    )
  );

-- Colony attendance policies
CREATE POLICY "Users can view attendance in colonies they created" ON public.colony_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_attendance.colony_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create attendance in colonies they created" ON public.colony_attendance
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_attendance.colony_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update attendance in colonies they created" ON public.colony_attendance
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_attendance.colony_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete attendance in colonies they created" ON public.colony_attendance
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = colony_attendance.colony_id 
      AND created_by = auth.uid()
    )
  );

-- Excel imports policies
CREATE POLICY "Users can view imports for colonies they created" ON public.excel_imports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = excel_imports.colony_id 
      AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create imports for colonies they created" ON public.excel_imports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.colonies 
      WHERE id = excel_imports.colony_id 
      AND created_by = auth.uid()
    )
  );

-- Admin policies (if user is admin, they can access everything)
-- Usar auth.jwt() para evitar recursión en policies
CREATE POLICY "Admins can access all colonies" ON public.colonies
  FOR ALL USING (
    (auth.jwt() ->> 'role')::text = 'admin'
  );

CREATE POLICY "Admins can access all colony students" ON public.colony_students
  FOR ALL USING (
    (auth.jwt() ->> 'role')::text = 'admin'
  );

CREATE POLICY "Admins can access all colony attendance" ON public.colony_attendance
  FOR ALL USING (
    (auth.jwt() ->> 'role')::text = 'admin'
  );

CREATE POLICY "Admins can access all excel imports" ON public.excel_imports
  FOR ALL USING (
    (auth.jwt() ->> 'role')::text = 'admin'
  );
