export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class NaoAutorizadoError extends AppError {
  constructor(message = "Não autorizado") {
    super(message, 401);
  }
}

export class ProibidoError extends AppError {
  constructor(message = "Acesso negado para este papel de usuário") {
    super(message, 403);
  }
}

export class NaoEncontradoError extends AppError {
  constructor(message = "Registro não encontrado") {
    super(message, 404);
  }
}
