import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { omitir, iniciarEntorno } from './entorno.js';
import { png } from '../imagenes-de-prueba.js';

// SPEC.md § 2.1-2.2: registro, lista, ficha, edición y baja lógica contra la BD de pruebas.
describe('API de terapeutas', { skip: omitir }, () => {
  let entorno;
  let api;

  before(async () => {
    entorno = await iniciarEntorno();
    api = entorno.api;
  });

  after(async () => {
    await entorno?.cerrar();
  });

  let consecutivo = 0;
  function datos(cambios = {}) {
    consecutivo += 1;
    const n = String(consecutivo).padStart(4, '0');
    return {
      nombre: `Terapeuta ${n}`,
      telefono: `999100${n}`,
      fechaNacimiento: '15/03/1990',
      correo: `terapeuta.${n}@uady.mx`,
      cedula: `1000${n}`,
      ...cambios,
    };
  }

  async function registrar(cambios) {
    const res = await api('POST', '/terapeutas', { form: datos(cambios) });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.terapeuta;
  }

  const fotoPng = (lado = 200) => new Blob([png(lado, lado)], { type: 'image/png' });
  const existeEnDisco = (url) =>
    access(path.join(entorno.uploadsDir, url.replace('/uploads/', ''))).then(
      () => true,
      () => false
    );

  test('sin sesión responde 401 en todas las rutas', async () => {
    for (const [metodo, ruta] of [
      ['GET', '/terapeutas'],
      ['POST', '/terapeutas'],
      ['GET', '/terapeutas/1'],
      ['PUT', '/terapeutas/1'],
      ['PATCH', '/terapeutas/1/estado'],
    ]) {
      const res = await api(metodo, ruta, { sinSesion: true });
      assert.equal(res.status, 401, `${metodo} ${ruta}`);
    }
  });

  describe('registro (RF 2.1)', () => {
    test('registra y rechaza duplicados', async () => {
      const t = await registrar({ foto: fotoPng() });
      assert.equal(t.activo, true);
      assert.ok(await existeEnDisco(t.fotoPerfil));

      const dup = await api('POST', '/terapeutas', { form: datos({ cedula: t.cedula }) });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.errors[0].field, 'cedula');
    });

    test('rechaza una foto de 199x199', async () => {
      const res = await api('POST', '/terapeutas', { form: datos({ foto: fotoPng(199) }) });
      assert.equal(res.status, 400);
      assert.equal(res.body.errors[0].field, 'foto');
    });
  });

  describe('ficha (RF 2.2.1-2.2.2)', () => {
    test('devuelve todos los datos del terapeuta', async () => {
      const t = await registrar({ nombre: 'María García López', fechaNacimiento: '14/08/1985' });
      const res = await api('GET', `/terapeutas/${t.id}`);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.terapeuta, t);
      assert.equal(res.body.terapeuta.fechaNacimiento, '1985-08-14');
    });

    test('id inexistente o inválido responde 404', async () => {
      assert.equal((await api('GET', '/terapeutas/999999')).status, 404);
      assert.equal((await api('GET', '/terapeutas/abc')).status, 404);
      assert.equal((await api('GET', '/terapeutas/0')).status, 404);
    });
  });

  describe('edición (RF 2.2.3-2.2.4)', () => {
    test('actualiza los datos y la ficha refleja los cambios', async () => {
      const t = await registrar();
      const nuevos = datos({ nombre: 'Nombre Editado', fechaNacimiento: '01/01/1980' });
      const res = await api('PUT', `/terapeutas/${t.id}`, { form: nuevos });
      assert.equal(res.status, 200, JSON.stringify(res.body));

      const { body } = await api('GET', `/terapeutas/${t.id}`);
      assert.equal(body.terapeuta.nombre, 'Nombre Editado');
      assert.equal(body.terapeuta.correo, nuevos.correo);
      assert.equal(body.terapeuta.fechaNacimiento, '1980-01-01');
    });

    test('puede conservar su propio correo, teléfono y cédula', async () => {
      const t = await registrar();
      const res = await api('PUT', `/terapeutas/${t.id}`, {
        form: { nombre: 'Otro Nombre', telefono: t.telefono, fechaNacimiento: '15/03/1990', correo: t.correo, cedula: t.cedula },
      });
      assert.equal(res.status, 200, JSON.stringify(res.body));
    });

    test('no puede tomar el correo, teléfono o cédula de otro terapeuta', async () => {
      const a = await registrar();
      const b = await registrar();
      for (const [campo, valor] of [
        ['correo', a.correo],
        ['telefono', a.telefono],
        ['cedula', a.cedula],
      ]) {
        const res = await api('PUT', `/terapeutas/${b.id}`, { form: datos({ [campo]: valor }) });
        assert.equal(res.status, 409, campo);
        assert.equal(res.body.errors[0].field, campo);
      }
    });

    test('aplica las mismas validaciones que el registro', async () => {
      const t = await registrar();
      const res = await api('PUT', `/terapeutas/${t.id}`, {
        form: datos({ nombre: 'a'.repeat(51), telefono: '123', fechaNacimiento: '31/02/1990', correo: 'x@gmail.com', cedula: '12' }),
      });
      assert.equal(res.status, 400);
      assert.deepEqual(
        res.body.errors.map((e) => e.field).sort(),
        ['cedula', 'correo', 'fechaNacimiento', 'nombre', 'telefono']
      );
    });

    test('reemplazar la foto borra la anterior; quitarFoto la elimina', async () => {
      const t = await registrar({ foto: fotoPng() });
      const reemplazo = await api('PUT', `/terapeutas/${t.id}`, { form: datos({ foto: fotoPng(300) }) });
      assert.equal(reemplazo.status, 200);
      const nueva = reemplazo.body.terapeuta.fotoPerfil;
      assert.notEqual(nueva, t.fotoPerfil);
      assert.equal(await existeEnDisco(t.fotoPerfil), false);
      assert.equal(await existeEnDisco(nueva), true);

      const sinFoto = await api('PUT', `/terapeutas/${t.id}`, { form: datos({ quitarFoto: '1' }) });
      assert.equal(sinFoto.status, 200);
      assert.equal(sinFoto.body.terapeuta.fotoPerfil, null);
      assert.equal(await existeEnDisco(nueva), false);
    });

    test('sin foto nueva conserva la actual', async () => {
      const t = await registrar({ foto: fotoPng() });
      const res = await api('PUT', `/terapeutas/${t.id}`, { form: datos() });
      assert.equal(res.body.terapeuta.fotoPerfil, t.fotoPerfil);
      assert.equal(await existeEnDisco(t.fotoPerfil), true);
    });

    test('id inexistente responde 404', async () => {
      const res = await api('PUT', '/terapeutas/999999', { form: datos() });
      assert.equal(res.status, 404);
    });
  });

  describe('baja lógica', () => {
    test('dar de baja lo saca de activos y reactivar lo regresa', async () => {
      const t = await registrar();
      const ids = async (estado) => (await api('GET', `/terapeutas?estado=${estado}`)).body.terapeutas.map((x) => x.id);

      const baja = await api('PATCH', `/terapeutas/${t.id}/estado`, { json: { activo: false } });
      assert.equal(baja.status, 200);
      assert.equal(baja.body.terapeuta.activo, false);
      assert.ok(baja.body.terapeuta.fechaBaja);
      assert.ok(!(await ids('activos')).includes(t.id));
      assert.ok((await ids('inactivos')).includes(t.id));
      assert.ok((await ids('todos')).includes(t.id));
      assert.ok(!(await ids('')).includes(t.id), 'por defecto solo activos');

      const alta = await api('PATCH', `/terapeutas/${t.id}/estado`, { json: { activo: true } });
      assert.equal(alta.body.terapeuta.activo, true);
      assert.equal(alta.body.terapeuta.fechaBaja, null);
      assert.ok((await ids('activos')).includes(t.id));
      assert.ok(!(await ids('inactivos')).includes(t.id));
    });

    test('un dado de baja conserva sus datos únicos y el 409 lo indica', async () => {
      const t = await registrar();
      await api('PATCH', `/terapeutas/${t.id}/estado`, { json: { activo: false } });
      const res = await api('POST', '/terapeutas', { form: datos({ correo: t.correo }) });
      assert.equal(res.status, 409);
      assert.match(res.body.errors[0].message, /dado de baja/);
    });

    test('valida el cuerpo y el id', async () => {
      const t = await registrar();
      assert.equal((await api('PATCH', `/terapeutas/${t.id}/estado`, { json: { activo: 'no' } })).status, 400);
      assert.equal((await api('PATCH', '/terapeutas/999999/estado', { json: { activo: false } })).status, 404);
    });
  });

  describe('lista (RF 2.2.1)', () => {
    test('busca por nombre, correo y cédula, y ordena', async () => {
      // Abel se registra primero: por nombre va antes, por fecha de registro va después.
      const y = await registrar({ nombre: 'Abel Búsqueda' });
      const x = await registrar({ nombre: 'Zoila Búsqueda', correo: 'zoila.unica@uady.mx', cedula: '55500011' });
      const buscar = async (query) => (await api('GET', `/terapeutas?${query}`)).body.terapeutas.map((t) => t.id);

      assert.deepEqual(await buscar('q=zoila'), [x.id]);
      assert.deepEqual(await buscar('q=ZOILA.UNICA'), [x.id]);
      assert.deepEqual(await buscar('q=5550001'), [x.id]);
      assert.deepEqual(await buscar(`q=${encodeURIComponent('búsqueda')}`), [y.id, x.id]);
      assert.deepEqual(await buscar(`q=${encodeURIComponent('búsqueda')}&orden=registro`), [x.id, y.id]);
      assert.deepEqual(await buscar('q=%25'), []);
    });
  });
});
