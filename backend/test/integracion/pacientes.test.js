import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { omitir, iniciarEntorno } from './entorno.js';
import { png } from '../imagenes-de-prueba.js';

// ERS § 3 (RF 3.1-3.3): registro con adjuntos, lista, ficha, edición y baja lógica contra la BD de pruebas.
describe('API de pacientes', { skip: omitir }, () => {
  let entorno;
  let api;

  before(async () => {
    entorno = await iniciarEntorno();
    api = entorno.api;
  });

  after(async () => {
    await entorno?.cerrar();
  });

  const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let consecutivo = 0;
  function datos(cambios = {}) {
    consecutivo += 1;
    const n = String(consecutivo).padStart(4, '0');
    const letras = LETRAS[Math.floor(consecutivo / 26) % 26] + LETRAS[consecutivo % 26];
    return {
      nombre_completo: `Paciente ${n}`,
      curp: `PA${letras}900315HYNRRS09`,
      sexo: 'F',
      fecha_nacimiento: '15/03/1990',
      telefono: `999200${n}`,
      ...cambios,
    };
  }

  const pdf = (nombre = 'expediente.pdf') =>
    new File([Buffer.from('%PDF-1.4\n%prueba\n')], nombre, { type: 'application/pdf' });
  const imagen = (nombre = 'identificacion.png') => new File([png(10, 10)], nombre, { type: 'image/png' });

  async function registrar(cambios = {}, archivos = [pdf()]) {
    const res = await api('POST', '/pacientes', { form: { ...datos(cambios), archivos } });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.paciente;
  }

  const archivosEnDisco = () => readdir(path.join(entorno.uploadsDir, 'pacientes')).catch(() => []);

  test('sin sesión responde 401 en todas las rutas', async () => {
    for (const [metodo, ruta] of [
      ['GET', '/pacientes'],
      ['GET', '/pacientes?q=ana'],
      ['POST', '/pacientes'],
      ['GET', '/pacientes/1'],
      ['PUT', '/pacientes/1'],
      ['PATCH', '/pacientes/1/estado'],
      ['GET', '/pacientes/1/archivos/1'],
    ]) {
      const res = await api(metodo, ruta, { sinSesion: true });
      assert.equal(res.status, 401, `${metodo} ${ruta}`);
    }
  });

  describe('registro (RF 3.1)', () => {
    test('registra con adjuntos y rechaza CURP o teléfono duplicados', async () => {
      const p = await registrar({}, [pdf(), imagen('identificación.png')]);
      assert.equal(p.activo, true);
      assert.equal(p.fechaBaja, null);
      assert.deepEqual(
        p.archivos.map((a) => [a.nombre, a.tipo]),
        [
          ['expediente.pdf', 'pdf'],
          ['identificación.png', 'png'],
        ]
      );

      const dupCurp = await api('POST', '/pacientes', { form: { ...datos({ curp: p.curp }), archivos: [pdf()] } });
      assert.equal(dupCurp.status, 409);
      assert.deepEqual(dupCurp.body.errors[0], { field: 'curp', message: 'Ese CURP ya está registrado.' });

      const dupTel = await api('POST', '/pacientes', { form: { ...datos({ telefono: p.telefono }), archivos: [pdf()] } });
      assert.equal(dupTel.status, 409);
      assert.equal(dupTel.body.errors[0].field, 'telefono');
    });

    test('exige al menos un adjunto', async () => {
      const res = await api('POST', '/pacientes', { form: datos() });
      assert.equal(res.status, 400);
      assert.equal(res.body.errors[0].field, 'archivos');
    });

    test('rechaza un adjunto cuyo contenido no es PDF, JPG ni PNG aunque lo declare', async () => {
      const antes = (await archivosEnDisco()).length;
      const falso = new File([Buffer.from('no soy un pdf')], 'falso.pdf', { type: 'application/pdf' });
      const res = await api('POST', '/pacientes', { form: { ...datos(), archivos: [falso] } });
      assert.equal(res.status, 400);
      assert.equal(res.body.errors[0].field, 'archivos');
      assert.match(res.body.errors[0].message, /falso\.pdf/);
      assert.equal((await archivosEnDisco()).length, antes);
    });

    test('rechaza adjuntos de más de 5 MB', async () => {
      const grande = new File([Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(5 * 1024 * 1024)])], 'grande.pdf', {
        type: 'application/pdf',
      });
      const res = await api('POST', '/pacientes', { form: { ...datos(), archivos: [grande] } });
      assert.equal(res.status, 400);
      assert.equal(res.body.errors[0].field, 'archivos');
    });

    test('exige edad mínima de 7 años (RF 3.1.9)', async () => {
      const hoy = new Date();
      const hace6 = `01/01/${hoy.getFullYear() - 6}`;
      const res = await api('POST', '/pacientes', { form: { ...datos({ fecha_nacimiento: hace6 }), archivos: [pdf()] } });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body.errors[0], {
        field: 'fecha_nacimiento',
        message: 'El paciente debe tener al menos 7 años cumplidos.',
      });
    });

    test('un registro fallido por duplicado no deja archivos huérfanos', async () => {
      const p = await registrar();
      const antes = (await archivosEnDisco()).length;
      const res = await api('POST', '/pacientes', { form: { ...datos({ curp: p.curp }), archivos: [pdf()] } });
      assert.equal(res.status, 409);
      assert.equal((await archivosEnDisco()).length, antes);
    });
  });

  describe('ficha y adjuntos (RF 3.2.2-3.2.3)', () => {
    test('devuelve todos los datos del paciente', async () => {
      const p = await registrar();
      const res = await api('GET', `/pacientes/${p.id}`);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.paciente, p);
      assert.equal(res.body.paciente.fechaNacimiento, '1990-03-15');
    });

    test('id inexistente o inválido responde 404', async () => {
      assert.equal((await api('GET', '/pacientes/999999')).status, 404);
      assert.equal((await api('GET', '/pacientes/abc')).status, 404);
    });

    test('descarga el adjunto con sesión y nunca desde /uploads', async () => {
      const p = await registrar();
      const [archivo] = p.archivos;
      const res = await api('GET', `/pacientes/${p.id}/archivos/${archivo.id}`, { crudo: true });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'application/pdf');
      assert.match(res.headers.get('content-disposition'), /expediente\.pdf/);
      assert.ok(res.body.subarray(0, 5).equals(Buffer.from('%PDF-')));

      const otro = await registrar();
      const ajeno = await api('GET', `/pacientes/${otro.id}/archivos/${archivo.id}`);
      assert.equal(ajeno.status, 404, 'un adjunto no se descarga desde la ficha de otro paciente');

      const [enDisco] = await archivosEnDisco();
      for (const ruta of [`/uploads/pacientes/${enDisco}`, `/uploads/%70acientes/${enDisco}`]) {
        const publico = await api('GET', ruta, { sinSesion: true });
        assert.equal(publico.status, 404, ruta);
      }
    });
  });

  describe('edición (RF 3.2.4-3.2.6)', () => {
    test('actualiza los datos y la ficha refleja los cambios', async () => {
      const p = await registrar();
      const cambios = datos({ nombre_completo: 'Nombre Editado', sexo: 'O' });
      const res = await api('PUT', `/pacientes/${p.id}`, { form: cambios });
      assert.equal(res.status, 200, JSON.stringify(res.body));

      const ficha = (await api('GET', `/pacientes/${p.id}`)).body.paciente;
      assert.equal(ficha.nombre, 'Nombre Editado');
      assert.equal(ficha.sexo, 'O');
      assert.equal(ficha.curp, cambios.curp);
      assert.equal(ficha.telefono, cambios.telefono);
      assert.equal(ficha.archivos.length, 1, 'sin cambios en adjuntos se conservan');
    });

    test('guarda, edita y borra el correo opcional (RF 5.1.14)', async () => {
      const p = await registrar({ correo: 'Tutor@Example.com' });
      assert.equal(p.correo, 'tutor@example.com');
      const sin = await api('PUT', `/pacientes/${p.id}`, { form: datos({ curp: p.curp, telefono: p.telefono, correo: '' }) });
      assert.equal(sin.status, 200, JSON.stringify(sin.body));
      assert.equal((await api('GET', `/pacientes/${p.id}`)).body.paciente.correo, null);
      const invalido = await api('PUT', `/pacientes/${p.id}`, { form: datos({ curp: p.curp, telefono: p.telefono, correo: 'no-es-correo' }) });
      assert.equal(invalido.status, 400);
      assert.deepEqual(invalido.body.errors.map((e) => e.field), ['correo']);
    });

    test('puede conservar su propio CURP y teléfono, pero no tomar los de otro', async () => {
      const p = await registrar();
      const otro = await registrar();
      const propio = await api('PUT', `/pacientes/${p.id}`, { form: datos({ curp: p.curp, telefono: p.telefono }) });
      assert.equal(propio.status, 200);

      const ajeno = await api('PUT', `/pacientes/${p.id}`, { form: datos({ curp: otro.curp }) });
      assert.equal(ajeno.status, 409);
      assert.equal(ajeno.body.errors[0].field, 'curp');
    });

    test('aplica las mismas validaciones que el registro', async () => {
      const p = await registrar();
      const res = await api('PUT', `/pacientes/${p.id}`, { form: datos({ curp: 'ABC', telefono: '123' }) });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body.errors.map((e) => e.field).sort(), ['curp', 'telefono']);
    });

    test('agrega y quita adjuntos; los quitados se borran del disco', async () => {
      const p = await registrar({}, [pdf('a.pdf'), pdf('b.pdf')]);
      const [a, b] = p.archivos;
      const antes = (await archivosEnDisco()).length;

      const res = await api('PUT', `/pacientes/${p.id}`, {
        form: { ...datos({ curp: p.curp, telefono: p.telefono }), quitarArchivos: [String(a.id)], archivos: [imagen('c.png')] },
      });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(
        res.body.paciente.archivos.map((x) => x.nombre),
        ['b.pdf', 'c.png']
      );
      assert.equal((await archivosEnDisco()).length, antes);
      assert.equal((await api('GET', `/pacientes/${p.id}/archivos/${a.id}`)).status, 404);
      assert.equal((await api('GET', `/pacientes/${p.id}/archivos/${b.id}`, { crudo: true })).status, 200);
    });

    test('no permite quitar el último adjunto', async () => {
      const p = await registrar();
      const antes = (await archivosEnDisco()).length;
      const res = await api('PUT', `/pacientes/${p.id}`, {
        form: { ...datos({ curp: p.curp, telefono: p.telefono }), quitarArchivos: String(p.archivos[0].id) },
      });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body.errors[0], {
        field: 'archivos',
        message: 'El paciente debe conservar al menos un archivo adjunto.',
      });
      assert.equal((await archivosEnDisco()).length, antes, 'el archivo no se borra si la edición falla');
      assert.equal((await api('GET', `/pacientes/${p.id}`)).body.paciente.archivos.length, 1);
    });

    test('id inexistente responde 404', async () => {
      const res = await api('PUT', '/pacientes/999999', { form: datos() });
      assert.equal(res.status, 404);
    });
  });

  describe('baja lógica (RF 3.3)', () => {
    test('dar de baja lo saca de activos y reactivar lo regresa', async () => {
      const p = await registrar();
      const ids = async (estado) => (await api('GET', `/pacientes?estado=${estado}`)).body.pacientes.map((x) => x.id);

      const baja = await api('PATCH', `/pacientes/${p.id}/estado`, { json: { activo: false } });
      assert.equal(baja.status, 200);
      assert.equal(baja.body.message, 'Paciente dado de baja.');
      assert.equal(baja.body.paciente.activo, false);
      assert.ok(baja.body.paciente.fechaBaja);
      assert.ok(!(await ids('activos')).includes(p.id));
      assert.ok((await ids('inactivos')).includes(p.id));
      assert.ok((await ids('todos')).includes(p.id));
      assert.ok(!(await ids('')).includes(p.id), 'por defecto solo activos');

      const ficha = await api('GET', `/pacientes/${p.id}`);
      assert.equal(ficha.status, 200, 'la ficha de un dado de baja sigue disponible');

      const alta = await api('PATCH', `/pacientes/${p.id}/estado`, { json: { activo: true } });
      assert.equal(alta.body.paciente.activo, true);
      assert.equal(alta.body.paciente.fechaBaja, null);
      assert.ok((await ids('activos')).includes(p.id));
    });

    test('un dado de baja conserva sus datos únicos, se puede editar y el 409 lo indica', async () => {
      const p = await registrar();
      await api('PATCH', `/pacientes/${p.id}/estado`, { json: { activo: false } });

      const res = await api('POST', '/pacientes', { form: { ...datos({ curp: p.curp }), archivos: [pdf()] } });
      assert.equal(res.status, 409);
      assert.match(res.body.errors[0].message, /dado de baja/);

      const edicion = await api('PUT', `/pacientes/${p.id}`, { form: datos({ curp: p.curp, telefono: p.telefono }) });
      assert.equal(edicion.status, 200);
      assert.equal(edicion.body.paciente.activo, false);
    });

    test('la búsqueda rápida incluye a los dados de baja', async () => {
      const p = await registrar({ nombre_completo: 'Baja Buscable' });
      await api('PATCH', `/pacientes/${p.id}/estado`, { json: { activo: false } });
      const res = await api('GET', `/pacientes?q=${encodeURIComponent('Baja Buscable')}`);
      assert.deepEqual(
        res.body.pacientes.map((x) => [x.id, x.activo]),
        [[p.id, false]]
      );
    });

    test('valida el cuerpo y el id', async () => {
      const p = await registrar();
      assert.equal((await api('PATCH', `/pacientes/${p.id}/estado`, { json: { activo: 'no' } })).status, 400);
      assert.equal((await api('PATCH', '/pacientes/999999/estado', { json: { activo: false } })).status, 404);
    });
  });

  describe('lista (RF 3.2.1)', () => {
    test('ordena por nombre o por fecha de registro', async () => {
      // Abel se registra primero: por nombre va antes, por fecha de registro va después.
      const abel = await registrar({ nombre_completo: 'AAA Abel Orden' });
      const zoila = await registrar({ nombre_completo: 'AAA Zoila Orden' });
      const ids = async (query) =>
        (await api('GET', `/pacientes?${query}`)).body.pacientes.map((x) => x.id).filter((id) => [abel.id, zoila.id].includes(id));

      assert.deepEqual(await ids('orden=nombre'), [abel.id, zoila.id]);
      assert.deepEqual(await ids('orden=registro'), [zoila.id, abel.id]);
    });
  });
});
