"""
Script utilitário para criar um usuário no Supabase Auth.
Execute uma única vez e depois delete o arquivo.

Uso:
    python create_user.py --email medico@clinica.com --password SuaSenha123
"""

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Erro: SUPABASE_URL e SUPABASE_KEY devem estar no arquivo .env")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Criar usuário no Supabase Auth")
    parser.add_argument("--email", required=True, help="E-mail do usuário")
    parser.add_argument("--password", required=True, help="Senha (mínimo 6 caracteres)")
    args = parser.parse_args()

    if len(args.password) < 6:
        print("Erro: a senha deve ter pelo menos 6 caracteres.")
        sys.exit(1)

    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # admin.create_user requer a service_role key
    response = client.auth.admin.create_user(
        {
            "email": args.email,
            "password": args.password,
            "email_confirm": True,   # confirma o e-mail automaticamente
        }
    )

    print(f"\n✅ Usuário criado com sucesso!")
    print(f"   ID:    {response.user.id}")
    print(f"   Email: {response.user.email}")
    print("\nDelete este script após o uso.")


if __name__ == "__main__":
    main()
