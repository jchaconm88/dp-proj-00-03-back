-- =============================================================================
-- RLS Policies: aislamiento de datos por tenant
-- Requisito 1.4, 9.2: datos de cada tenant aislados logicamente
-- =============================================================================

-- Funcion helper: establece el tenant actual en la sesion de BD
CREATE OR REPLACE FUNCTION set_current_tenant(p_tenant_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::text, true);
END;
$$ LANGUAGE plpgsql;

-- Funcion helper: obtiene el tenant actual de la sesion
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', true)::uuid;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS en todas las tablas con tenant_id
-- Nota: Payload CMS crea las tablas con sus migraciones primero,
-- luego este script habilita RLS sobre ellas.

DO $$
DECLARE
  t text;
  tables_with_tenant text[] := ARRAY[
    'domains',
    'pages',
    'page_translations',
    'posts',
    'post_translations',
    'menus',
    'menu_items',
    'media',
    'contact_submissions',
    'tenant_languages',
    'user_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables_with_tenant LOOP
    -- Habilitar RLS si la tabla existe
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

      -- Eliminar politica existente si hay
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);

      -- Crear politica de aislamiento
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = current_tenant_id())
         WITH CHECK (tenant_id = current_tenant_id())',
        t
      );

      RAISE NOTICE 'RLS habilitado en tabla: %', t;
    ELSE
      RAISE WARNING 'Tabla % no encontrada, omitiendo RLS', t;
    END IF;
  END LOOP;
END;
$$;

-- La tabla tenants NO tiene RLS (es de nivel plataforma)
-- El acceso se controla via la aplicacion (solo platform_admin puede gestionar tenants)
