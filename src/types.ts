export type Credentials = {
  username: string;
  password: string;
};

// https://docs.aws.amazon.com/secretsmanager/latest/userguide/reference_secret_json_structure.html
export type DBSecret = Credentials & {
  engine?: string;
  masterarn: string;
  host: string;
  port: number | string;
  dbname: string;
  dbInstanceIdentifier?: string;
  dbClusterIdentifier?: string;
};

export type DBSecretStrict = Omit<DBSecret, 'port'> & {
  port: number;
};

export type DBConfig = {
  dbName: string;
  dbSchema: string;
  migrationRole: string;
  migrationUser: string;
  migrationPassword: string;
  appRole?: string;
  appUser?: string;
  appPassword?: string;
};
