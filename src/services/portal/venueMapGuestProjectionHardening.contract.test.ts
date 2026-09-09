import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration0026 = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0026_venue_map_guest_projection_hardening.sql'),
  'utf8',
);

describe('migration 0026 authoritative guest-map projection', () => {
  it('replaces the existing projection signature without changing its callers', () => {
    expect(migration0026).toContain(
      'create or replace function public.build_guest_venue_map_projection(',
    );
    expect(migration0026).toMatch(
      /revoke all on function public\.build_guest_venue_map_projection\(jsonb, jsonb\)[\s\S]*?from public, anon, authenticated;/,
    );
  });

  it('rejects the reserved scope sentinel before relevant-space expansion', () => {
    expect(migration0026).toMatch(
      /p_selected_space_ids[\s\S]*?<> '__invalid_event_scope__'/,
    );
  });

  it('keeps only the first distinct, non-self contingency per outdoor source', () => {
    expect(migration0026).toContain('v_outdoor_id = v_indoor_id');
    expect(migration0026).toContain('v_contingency_id = any(v_seen_contingency_ids)');
    expect(migration0026).toContain('v_outdoor_id = any(v_seen_outdoor_ids)');
    expect(migration0026).toMatch(
      /into v_relevant_ids[\s\S]*?jsonb_array_elements\(v_contingencies\)/,
    );
  });

  it('counts structural identities before visibility and rejects every duplicate object id', () => {
    expect((migration0026.match(/count\(\*\) over \(/g) || [])).toHaveLength(3);
    expect((migration0026.match(/id_occurrences = 1/g) || [])).toHaveLength(3);

    const sections = [
      migration0026.slice(
        migration0026.indexOf('-- Rebuild points'),
        migration0026.indexOf('-- Rebuild each route'),
      ),
      migration0026.slice(
        migration0026.indexOf('-- Rebuild each route'),
        migration0026.indexOf('-- Mirror the client projector'),
      ),
      migration0026.slice(
        migration0026.indexOf('-- Drawing vertices'),
        migration0026.indexOf('v_background_url := case'),
      ),
    ];

    for (const section of sections) {
      expect(section).toContain('count(*) over (');
      expect(section).toContain('id_occurrences = 1');
      expect(section.indexOf('id_occurrences = 1')).toBeLessThan(
        section.indexOf('public.guest_venue_map_object_visible('),
      );
    }
  });

  it('deeply allowlists vertices and constrains complete supported shapes', () => {
    expect(migration0026).not.toContain("'points', drawing.value->'points'");
    expect(migration0026).toContain("jsonb_array_elements(drawing.value->'points')");
    expect(migration0026).toMatch(
      /'points', case[\s\S]*?jsonb_build_object\([\s\S]*?'x'[\s\S]*?'y'/,
    );
    expect(migration0026).toContain("drawing_type in ('zone', 'rectangle')");
    expect(migration0026).toContain('least(v_width - drawing_width, raw_x)');
    expect(migration0026).toContain("drawing_type = 'circle'");
    expect(migration0026).toContain('least(v_height - drawing_radius, raw_y)');
    expect(migration0026).toContain("from positioned as drawing");
  });

  it('prunes orphan route components and their path-only nodes', () => {
    expect(migration0026).toContain('with recursive');
    expect(migration0026).toContain("point_meta.kind <> 'path'");
    expect(migration0026).toContain("or bool_or(point_meta.kind = 'space')");
    expect(migration0026).toMatch(
      /point\.value->>'kind' <> 'path'[\s\S]*?jsonb_array_elements\(v_routes\)/,
    );
  });
});
