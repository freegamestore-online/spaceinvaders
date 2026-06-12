using System;
using System.Collections.Generic;
using System.Threading;

class Program
{
    // Configurações do ecrã
    static int larguraJanela = 40;
    static int alturaJanela = 20;

    // Posições do jogador
    static int jogadorX = larguraJanela / 2;
    static int jogadorY = alturaJanela - 2;

    // Listas para tiros e inimigos
    static List<int[]> tiros = new List<int[]>(); // Cada tiro: {X, Y}
    static List<int[]> inimigos = new List<int[]>(); // Cada inimigo: {X, Y}

    static int pontuacao = 0;
    static bool jogoAdecorrer = true;
    static Random random = new Random();

    static void Main()
    {
        Console.CursorVisible = false;
        Console.SetWindowSize(larguraJanela + 1, alturaJanela + 2);
        Console.SetBufferSize(larguraJanela + 1, alturaJanela + 2);

        // Inicializar alguns inimigos no topo
        for (int i = 5; i < larguraJanela - 5; i += 4)
        {
            inimigos.Add(new int[] { i, 2 });
            inimigos.Add(new int[] { i, 4 });
        }

        // Loop principal do jogo
        while (jogoAdecorrer)
        {
            LerInput();
            AtualizarLogica();
            DesenharEcra();
            Thread.Sleep(50); // Controla a velocidade do jogo
        }

        Console.Clear();
        Console.SetCursorPosition(larguraJanela / 4, alturaJanela / 2);
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine($"FIM DE JOGO! Pontuação Final: {pontuacao}");
        Console.ResetColor();
    }

    static void LerInput()
    {
        if (Console.KeyAvailable)
        {
            var tecla = Console.ReadKey(true).Key;
            if (tecla == ConsoleKey.LeftArrow && jogadorX > 1)
            {
                jogadorX--;
            }
            if (tecla == ConsoleKey.RightArrow && jogadorX < larguraJanela - 2)
            {
                jogadorX++;
            }
            if (tecla == ConsoleKey.Spacebar)
            {
                tiros.Add(new int[] { jogadorX, jogadorY - 1 });
            }
        }
    }

    static void AtualizarLogica()
    {
        // 1. Mover os tiros para cima
        for (int i = tiros.Count - 1; i >= 0; i--)
        {
            tiros[i][1]--;
            if (tiros[i][1] < 0)
            {
                tiros.RemoveAt(i);
            }
        }

        // 2. Mover inimigos aleatoriamente para baixo
        if (random.Next(0, 10) < 2)
        {
            foreach (var inimigo in inimigos)
            {
                inimigo[1]++;
                if (inimigo[1] >= jogadorY)
                {
                    jogoAdecorrer = false; // Inimigos invadiram a base
                }
            }
        }

        // 3. Gerar novos inimigos ocasionalmente
        if (random.Next(0, 100) < 5)
        {
            inimigos.Add(new int[] { random.Next(2, larguraJanela - 2), 1 });
        }

        // 4. Verificar colisões (Tiro atinge Inimigo)
        for (int t = tiros.Count - 1; t >= 0; t--)
        {
            for (int i = inimigos.Count - 1; i >= 0; i--)
            {
                if (tiros[t][0] == inimigos[i][0] && tiros[t][1] == inimigos[i][1])
                {
                    tiros.RemoveAt(t);
                    inimigos.RemoveAt(i);
                    pontuacao += 10;
                    break;
                }
            }
        }
    }

    static void DesenharEcra()
    {
        // Desenhar a moldura e limpar buffers antigos de forma rápida
        char[,] frame = new char[larguraJanela, alturaJanela];

        // Preencher o cenário vazio
        for (int y = 0; y < alturaJanela; y++)
        {
            for (int x = 0; x < larguraJanela; x++)
            {
                if (y == 0 || y == alturaJanela - 1 || x == 0 || x == larguraJanela - 1)
                    frame[x, y] = '#';
                else
                    frame[x, y] = ' ';
            }
        }

        // Inserir o Jogador
        frame[jogadorX, jogadorY] = 'A';

        // Inserir Tiros
        foreach (var tiro in tiros)
        {
            if (tiro[1] > 0 && tiro[1] < alturaJanela)
                frame[tiro[0], tiro[1]] = '|';
        }

        // Inserir Inimigos
        foreach (var inimigo in inimigos)
        {
            if (inimigo[1] > 0 && inimigo[1] < alturaJanela)
                frame[inimigo[0], inimigo[1]] = 'W';
        }

        // Renderizar tudo no ecrã de uma só vez para evitar piscar (flicker)
        Console.SetCursorPosition(0, 0);
        System.Text.StringBuilder sb = new System.Text.StringBuilder();
        for (int y = 0; y < alturaJanela; y++)
        {
            for (int x = 0; x < larguraJanela; x++)
            {
                sb.Append(frame[x, y]);
            }
            sb.AppendLine();
        }
        sb.AppendLine($" Pontos: {pontuacao} | Setas: Mover | Espaço: Disparar");
        Console.Write(sb.ToString());
    }
}
