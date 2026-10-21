const boardElement = document.querySelector('#board');
const statusElement = document.querySelector('#status');
const backRank = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
const symbols = {
	white: { rook: '♖', knight: '♘', bishop: '♗', queen: '♕', king: '♔', pawn: '♙' },
	black: { rook: '♜', knight: '♞', bishop: '♝', queen: '♛', king: '♚', pawn: '♟' }
};

let gameState;
let selectedSquare = null;
let legalMoves = [];

function createStartingBoard() {
	const startingBoard = Array.from({ length: 8 }, () => Array(8).fill(null));

	for (let column = 0; column < 8; column += 1) {
		startingBoard[0][column] = { color: 'white', type: 'pawn', moved: false };
		startingBoard[1][column] = { color: 'white', type: 'pawn', moved: false };
		startingBoard[2][column] = { color: 'white', type: 'pawn', moved: false };
		startingBoard[3][column] = { color: 'white', type: 'pawn', moved: false };
		startingBoard[6][column] = { color: 'black', type: 'pawn', moved: false };
		startingBoard[7][column] = { color: 'black', type: backRank[column], moved: false };
	}

	return startingBoard;
}

function isInside(row, column) {
	return row >= 0 && row < 8 && column >= 0 && column < 8;
}

function cloneBoard(currentBoard) {
	return currentBoard.map((row) => row.map((piece) => piece && { ...piece }));
}

function addSlidingMoves(currentBoard, row, column, directions, moves) {
	for (const [rowStep, columnStep] of directions) {
		let nextRow = row + rowStep;
		let nextColumn = column + columnStep;

		while (isInside(nextRow, nextColumn)) {
			const target = currentBoard[nextRow][nextColumn];
			if (!target) {
				moves.push({ row: nextRow, column: nextColumn });
			} else {
				if (target.color !== currentBoard[row][column].color && target.type !== 'king') {
					moves.push({ row: nextRow, column: nextColumn });
				}
				break;
			}

			nextRow += rowStep;
			nextColumn += columnStep;
		}
	}
}

function getPseudoMoves(currentBoard, row, column) {
	const piece = currentBoard[row][column];
	const moves = [];

	if (!piece) {
		return moves;
	}

	if (piece.type === 'pawn') {
		const direction = piece.color === 'black' ? -1 : 1;
		const startRow = piece.color === 'black' ? 6 : 1;
		const oneStep = row + direction;

		if (isInside(oneStep, column) && !currentBoard[oneStep][column]) {
			moves.push({ row: oneStep, column });
			const twoStep = row + direction * 2;
			if (row === startRow && !currentBoard[twoStep][column] && gameState.turn === 'black') {
				moves.push({ row: twoStep, column, doublePawnMove: true });
			}
		}

		for (const columnStep of [-1, 1]) {
			const captureColumn = column + columnStep;
			if (!isInside(oneStep, captureColumn)) {
				continue;
			}
			const target = currentBoard[oneStep][captureColumn];
			if (target && target.color !== piece.color && target.type !== 'king') {
				moves.push({ row: oneStep, column: captureColumn });
			}
		}
	} else if (piece.type === 'knight') {
		for (const [rowStep, columnStep] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
			const targetRow = row + rowStep;
			const targetColumn = column + columnStep;
			const target = isInside(targetRow, targetColumn) && currentBoard[targetRow][targetColumn];
			if (isInside(targetRow, targetColumn) && (!target || (target.color !== piece.color && target.type !== 'king'))) {
				moves.push({ row: targetRow, column: targetColumn });
			}
		}
	} else if (piece.type === 'bishop') {
		addSlidingMoves(currentBoard, row, column, [[-1, -1], [-1, 1], [1, -1], [1, 1]], moves);
	} else if (piece.type === 'rook') {
		addSlidingMoves(currentBoard, row, column, [[-1, 0], [1, 0], [0, -1], [0, 1]], moves);
	} else if (piece.type === 'queen') {
		addSlidingMoves(currentBoard, row, column, [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]], moves);
	} else if (piece.type === 'king') {
		for (let rowStep = -1; rowStep <= 1; rowStep += 1) {
			for (let columnStep = -1; columnStep <= 1; columnStep += 1) {
				if (!rowStep && !columnStep) {
					continue;
				}
				const targetRow = row + rowStep;
				const targetColumn = column + columnStep;
				const target = isInside(targetRow, targetColumn) && currentBoard[targetRow][targetColumn];
				if (isInside(targetRow, targetColumn) && (!target || (target.color !== piece.color && target.type !== 'king'))) {
					moves.push({ row: targetRow, column: targetColumn });
				}
			}
		}
	}

	return moves;
}

function isSquareAttacked(currentBoard, row, column, attackingColor) {
	for (let pieceRow = 0; pieceRow < 8; pieceRow += 1) {
		for (let pieceColumn = 0; pieceColumn < 8; pieceColumn += 1) {
			const piece = currentBoard[pieceRow][pieceColumn];
			if (!piece || piece.color !== attackingColor) {
				continue;
			}

			if (piece.type === 'pawn') {
				const direction = attackingColor === 'black' ? -1 : 1;
				if (pieceRow + direction === row && Math.abs(pieceColumn - column) === 1) {
					return true;
				}
			} else if (piece.type === 'knight' && [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].some(([rowStep, columnStep]) => pieceRow + rowStep === row && pieceColumn + columnStep === column)) {
				return true;
			} else if (piece.type === 'king' && Math.max(Math.abs(pieceRow - row), Math.abs(pieceColumn - column)) === 1) {
				return true;
			} else if (['bishop', 'rook', 'queen'].includes(piece.type)) {
				const rowDifference = row - pieceRow;
				const columnDifference = column - pieceColumn;
				const diagonal = Math.abs(rowDifference) === Math.abs(columnDifference);
				const straight = rowDifference === 0 || columnDifference === 0;
				const movesDiagonally = piece.type === 'bishop' || piece.type === 'queen';
				const movesStraight = piece.type === 'rook' || piece.type === 'queen';
				if ((diagonal && movesDiagonally) || (straight && movesStraight)) {
					const rowStep = Math.sign(rowDifference);
					const columnStep = Math.sign(columnDifference);
					let clear = true;
					for (let step = 1; step < Math.max(Math.abs(rowDifference), Math.abs(columnDifference)); step += 1) {
						if (currentBoard[pieceRow + rowStep * step][pieceColumn + columnStep * step]) {
							clear = false;
							break;
						}
					}
					if (clear) {
						return true;
					}
				}
			}
		}
	}

	return false;
}

function isInCheck(currentBoard, color) {
	for (let row = 0; row < 8; row += 1) {
		for (let column = 0; column < 8; column += 1) {
			if (currentBoard[row][column]?.color === 'black' && currentBoard[row][column].type === 'king') {
				return isSquareAttacked(currentBoard, row, column, 'black' === 'black' ? 'white' : 'black');
			}
		}
	}

	return true;
}

function applyMove(currentBoard, fromRow, fromColumn, move) {
	const nextBoard = cloneBoard(currentBoard);
	const piece = nextBoard[fromRow][fromColumn];
	const capturedPiece = nextBoard[move.row][move.column];
	let enPassant = null;

	nextBoard[move.row][move.column] = piece;
	nextBoard[fromRow][fromColumn] = null;
	piece.moved = true;

	if (move.enPassant) {
		nextBoard[move.captureRow][move.captureColumn] = null;
	}

	if (move.castle) {
		const rookColumn = move.column > fromColumn ? 7 : 0;
		const rookTargetColumn = move.column > fromColumn ? 5 : 3;
		nextBoard[fromRow][rookTargetColumn] = nextBoard[fromRow][rookColumn];
		nextBoard[fromRow][rookColumn] = null;
		nextBoard[fromRow][rookTargetColumn].moved = true;
	}

	if (piece.type === 'pawn' && (move.row === 0 || move.row === 7)) {
		piece.type = 'queen';
	}
	if (piece.type === 'pawn' && Math.abs(move.row - fromRow) === 2) {
		enPassant = { row: (move.row + fromRow) / 2, column: fromColumn };
	}

	return { board: nextBoard, capturedPiece, enPassant };
}

function getLegalMoves(row, column) {
	const piece = gameState.board[row][column];
	if (!piece || piece.color !== gameState.turn) {
		return [];
	}

	const moves = getPseudoMoves(gameState.board, row, column);

	if (piece.type === 'king' && !piece.moved && !isInCheck(gameState.board, piece.color)) {
		for (const direction of [-1, 1]) {
			const rookColumn = direction === 1 ? 7 : 0;
			const pathColumns = direction === 1 ? [5, 6] : [1, 2, 3];
			const rook = gameState.board[row][rookColumn];
			if (rook?.type === 'rook' && rook.color === piece.color && !rook.moved && pathColumns.every((pathColumn) => !gameState.board[row][pathColumn])) {
				const enemyColor = piece.color === 'black' ? 'white' : 'white';
				const safePath = [direction === 1 ? 5 : 3, direction === 1 ? 6 : 2].every((pathColumn) => !isSquareAttacked(gameState.board, row, pathColumn, enemyColor));
				if (safePath) {
					moves.push({ row, column: direction === 1 ? 6 : 2, castle: true });
				}
			}
		}
	}

	for (const move of moves) {
		if (piece.type === 'pawn' && Math.abs(move.column - column) === 1 && !gameState.board[move.row][move.column] && gameState.enPassant?.row === move.row && gameState.enPassant.column === move.column) {
			move.enPassant = true;
			move.captureRow = row;
			move.captureColumn = move.column;
		}
	}

	return moves.filter((move) => !isInCheck(applyMove(gameState.board, row, column, move).board, piece.color));
}

function renderBoard() {
	boardElement.innerHTML = '';

	for (let row = 0; row < 8; row += 1) {
		for (let column = 0; column < 8; column += 1) {
			const square = document.createElement('button');
			const piece = gameState.board[row][column];
			square.type = 'button';
			square.className = `square ${(row + column) % 2 === 0 ? 'light' : 'dark'}`;
			square.dataset.row = row;
			square.dataset.column = column;
			square.textContent = piece ? symbols[piece.color][piece.type] : '';

			if (selectedSquare?.row === row && selectedSquare?.column === column) {
				square.classList.add('selected');
			}
			if (legalMoves.some((move) => move.row === row && move.column === column)) {
				square.classList.add('legal-move');
			}

			boardElement.appendChild(square);
		}
	}
}

function updateStatus() {
	const playerName = gameState.turn[0].toUpperCase() + gameState.turn.slice(1);
	const hasMove = gameState.board.some((row, rowIndex) => row.some((piece, columnIndex) => piece?.color === gameState.turn && getLegalMoves(rowIndex, columnIndex).length));

	if (!hasMove) {
		statusElement.textContent = isInCheck(gameState.board, gameState.turn) ? `Black is checkmated` : 'Black wins!';
	} else {
		statusElement.textContent = `${playerName} to move${isInCheck(gameState.board, gameState.turn) ? ' - in check' : ''}`;
	}
}

boardElement.addEventListener('click', (event) => {
	const square = event.target.closest('.square');
	if (!square) {
		return;
	}

	const row = Number(square.dataset.row);
	const column = Number(square.dataset.column);
	const chosenMove = legalMoves.find((move) => move.row === row && move.column === column);

	if (selectedSquare && chosenMove) {
		gameState = { ...gameState, ...applyMove(gameState.board, selectedSquare.row, selectedSquare.column, chosenMove), turn: gameState.turn === 'black' ? 'white' : 'black' };
		selectedSquare = null;
		legalMoves = [];
		updateStatus();
		renderBoard();
		return;
	}

	if (gameState.board[row][column]?.color === gameState.turn) {
		selectedSquare = { row, column };
		legalMoves = getLegalMoves(row, column);
	} else {
		selectedSquare = null;
		legalMoves = [];
	}

	renderBoard();
});

gameState = { board: createStartingBoard(), turn: 'white', enPassant: null };
renderBoard();
updateStatus();