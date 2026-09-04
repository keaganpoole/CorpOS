"""Synthetic recovery drill on the explicitly named LOOPBACK fixture only.

Does not import application configuration or access Supabase/cloud services.
Creates two disposable PostgreSQL databases, tests pg_dump/pg_restore plus an
encrypted Storage-object backup with separate in-memory keys, then removes only
those databases. A cloud/PITR recovery rehearsal is still a deployment task.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
from uuid import uuid4
from unittest.mock import patch
import psycopg2
from psycopg2 import sql
from .envelope import b64, seal_file, open_file, KeyUnavailable
from .protected_data import ProtectedClient
from .test_phase57_database import PgDatabase


def run(port, binaries):
    # Exact source name and loopback are intentionally not configurable.
    admin=psycopg2.connect(host='127.0.0.1',port=port,user='postgres',dbname='postgres'); admin.autocommit=True
    names=['nodemere_restore_'+uuid4().hex for _ in range(2)]
    created=[]; connection=None
    def pg(executable,*args):
        subprocess.run([str(Path(binaries)/executable),'-h','127.0.0.1','-p',str(port),'-U','postgres',*args],check=True,capture_output=True,timeout=60)
    try:
        with tempfile.TemporaryDirectory(prefix='nodemere-synthetic-restore-') as directory:
            seed=str(Path(directory)/'fixture.dump'); backup=str(Path(directory)/'encrypted.dump')
            pg('pg_dump.exe','-Fc','-f',seed,'nodemere_phase57')
            with admin.cursor() as cursor:
                for name in names:
                    cursor.execute(sql.SQL('create database {}').format(sql.Identifier(name))); created.append(name)
            pg('pg_restore.exe','--exit-on-error','-d',names[0],seed)
            connection=psycopg2.connect(host='127.0.0.1',port=port,user='postgres',dbname=names[0])
            db=PgDatabase(connection); client=ProtectedClient(db)
            record=str(uuid4()); canary='SYNTHETIC_RESTORE_CANARY'
            secret=b64(os.urandom(32))  # Never written into either database/dump.
            with patch.dict(os.environ,{'NODEMERE_ENCRYPTION_MODE':'encrypt-new','NODEMERE_KEK_RING':json.dumps({'drill':secret}),'NODEMERE_ACTIVE_KEK':'drill'}):
                client.table('call_logs').insert({'id':record,'business_id':1,'user_id':'11111111-1111-4111-8111-111111111111','transcript_text':canary}).execute()
                object_context=dict(business_id=1,bucket='caller-documents',path='business/1/restore.pdf.ndmenc')
                encrypted_object=seal_file(db,canary.encode(),**object_context)
                object_backup=Path(directory)/'synthetic-object.backup'
                object_backup.write_bytes(encrypted_object)
                connection.commit(); connection.close(); connection=None
                pg('pg_dump.exe','-Fc','-f',backup,names[0])
                pg('pg_restore.exe','--exit-on-error','-d',names[1],backup)
                connection=psycopg2.connect(host='127.0.0.1',port=port,user='postgres',dbname=names[1])
                restored_db=PgDatabase(connection); restored=ProtectedClient(restored_db)
                row=restored.table('call_logs').select('transcript_text').eq('id',record).execute().data[0]
                assert row['transcript_text']==canary
                assert open_file(restored_db,object_backup.read_bytes(),**object_context)==canary.encode()
                with patch.dict(os.environ,{'NODEMERE_KEK_RING':'{}'}):
                    try: restored.table('call_logs').select('transcript_text').eq('id',record).execute()
                    except KeyUnavailable: pass
                    else: raise AssertionError('Missing recovery key was accepted')
                connection.close(); connection=None
            return {'database_restore':True,'encrypted_object_restore':True,'separate_key_recovery':True,'missing_key_fails_closed':True}
    finally:
        if connection: connection.close()
        with admin.cursor() as cursor:
            for name in created:
                if not name.startswith('nodemere_restore_') or len(name)!=49: raise RuntimeError('Unsafe cleanup target')
                cursor.execute(sql.SQL('drop database {}').format(sql.Identifier(name)))
        admin.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',required=True,type=int)
    parser.add_argument('--binaries',default=r'C:\Program Files\PostgreSQL\17\bin')
    args=parser.parse_args()
    print(json.dumps(run(args.port,args.binaries)))
