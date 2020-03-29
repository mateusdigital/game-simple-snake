//~---------------------------------------------------------------------------//
//                        _      _                 _   _                      //
//                    ___| |_ __| |_ __ ___   __ _| |_| |_                    //
//                   / __| __/ _` | '_ ` _ \ / _` | __| __|                   //
//                   \__ \ || (_| | | | | | | (_| | |_| |_                    //
//                   |___/\__\__,_|_| |_| |_|\__,_|\__|\__|                   //
//                                                                            //
//  File      : Snake.js                                                      //
//  Project   : stdmatt-games                                                 //
//  Date      : Aug 10, 2019                                                  //
//  License   : GPLv3                                                         //
//  Author    : stdmatt <stdmatt@pixelwizards.io>                             //
//  Copyright : stdmatt - 2019                                                //
//                                                                            //
//  Description :                                                             //
//   Just a simple snake game...                                              //
//---------------------------------------------------------------------------~//


//----------------------------------------------------------------------------//
// Constants                                                                  //
//----------------------------------------------------------------------------//
const BLOCK_SIZE         = 20;
const BLOCK_HALF_SIZE    = BLOCK_SIZE * 0.5;
const FOOD_MIN_COUNT     =  4;
const SNAKE_INITIAL_SIZE =  5;
const SNAKE_TIME_TO_MOVE = 0.1;

const SHADOW_SPREAD_MIN = SNAKE_INITIAL_SIZE;
const SHADOW_SPREAD_MAX = SNAKE_INITIAL_SIZE * 11;
const SHADOW_BLUR_MIN   = 15;
const SHADOW_BLUR_MAX   = 35;


//----------------------------------------------------------------------------//
// Vars                                                                       //
//----------------------------------------------------------------------------//
let snake;
let foods;
let field;
let trail;

let shadow_anim_group = null;
let shadow_spread     = SHADOW_SPREAD_MIN;


//----------------------------------------------------------------------------//
// Helper Functions                                                           //
//----------------------------------------------------------------------------//
//------------------------------------------------------------------------------
// https://kodhus.com/easings/
function Ease_OutElastic(t, b, c, d)
{
    var s=1.70158;var p=0;var a=c;
    if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
    if (a < Math.abs(c)) { a=c; var s=p/4; }
    else var s = p/(2*Math.PI) * Math.asin (c/a);
    return a*Math.pow(2,-10*t) * Math.sin( (t*d-s)*(2*Math.PI)/p ) + c + b;
}



//------------------------------------------------------------------------------
function ApplyShadowCSS()
{
    const shadow_blur = Math_Map(
        shadow_spread,
        SHADOW_SPREAD_MIN,
        SHADOW_SPREAD_MAX,
        SHADOW_BLUR_MIN,
        snake.blocks.length
    );

    const target_color  = snake.targetColor .hex();
    const current_color = snake.currentColor.hex();
    const css_str = String_Cat(
        "0px 0px ",
        shadow_blur,   "px ",
        shadow_spread, "px ",
        target_color
    );

    document.getElementById("canvas_div").style.boxShadow = css_str;
    document.getElementById("logo_div"  ).style.color     = current_color;
}

//------------------------------------------------------------------------------
function UpdateFieldShadow()
{
    const time_modifier = 0.6;
    const max_time      = (snake.TIME_TO_ANIMATE_COLOR * 1000) * time_modifier;

    // Discarding the previous Tween Group makes easier to not
    // have more than one tween running at any given type.
    shadow_anim_group = Tween_CreateGroup();
    Tween_CreateBasic(max_time, shadow_anim_group)
        .onUpdate((v)=>{
            const value = v.value;
            shadow_spread = Math_Map(
                v.value,
                0, 1,
                SHADOW_SPREAD_MIN,
                Math_Min(snake.blocks.length)
            )

            ApplyShadowCSS();
        })
        .easing(TWEEN.Easing.Circular.Out)
        .repeat(1)
        .yoyo(true)
        .start();
}

//------------------------------------------------------------------------------
function DrawBlock(x, y, color, scale, rotation)
{
    //
    // Render
    Canvas_Push();
        Canvas_SetFillStyle(color.hex());
        Canvas_Translate((x * BLOCK_SIZE) + BLOCK_HALF_SIZE, (y * BLOCK_SIZE) + BLOCK_HALF_SIZE);
        Canvas_Rotate(rotation);
        Canvas_Scale(scale, scale);
        Canvas_FillRect(-BLOCK_HALF_SIZE, -BLOCK_HALF_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    Canvas_Pop();
}

//------------------------------------------------------------------------------
function BlockRandomColor()
{
    let color = chroma.hsl(
        Random_Int(0, 360), 0.5, 0.5, "hsl"
    );

    return color;
}

//------------------------------------------------------------------------------
function CreateFood()
{
    while(1) {
        let found = true;
        let x = Random_Int(leftEdge, rightEdge);
        let y = Random_Int(topEdge, bottomEdge);

        for(let i = 0, len = snake.blocks.length; i < len; ++i) {
            let b = snake.blocks[i];
            if(b.position.x == x && b.position.y == y) {
                found = false;
                break;
            }
        }

        if(found) {
            foods.push(new Food(x, y));
            let b = Array_GetBack(foods);
            trail.addFood(b.block.position.x, b.block.position.y, b.color);
            return;
        }
    }
}

//------------------------------------------------------------------------------
function CheckSnakeFoodCollision(snake, foods)
{
    if(!snake.alive) {
        return;
    }

    let head_pos = snake.blocks[0].position;
    for(let i = 0, len = foods.length; i < len; ++i) {
        let food_pos = foods[i].block.position;
        if(head_pos.x != food_pos.x || head_pos.y != food_pos.y) {
            continue;
        }

        snake.grow();
        snake.changeColor(foods[i].color);

        Array_RemoveAt(foods, i);
        CreateFood();

        return;
    }
}

//------------------------------------------------------------------------------
function RestartGame()
{
    field = new Field();
    trail = new Trail();

    snake = new Snake(0, 0, SNAKE_INITIAL_SIZE, Vector_Create(1, 0));

    foods = [];
    for(let i = 0; i < FOOD_MIN_COUNT; ++i) {
        CreateFood();
    }

    UpdateFieldShadow();
}


//----------------------------------------------------------------------------//
// Block                                                                      //
//----------------------------------------------------------------------------//
class Block
{
    constructor(x, y)
    {
        this.position = Vector_Create(x, y);
        this.scale    = 1;
        this.rotation = 0;
    }
}


//----------------------------------------------------------------------------//
// Snake                                                                      //
//----------------------------------------------------------------------------//
class Snake
{
    //--------------------------------------------------------------------------
    constructor(x, y, size, dir)
    {
        // "Constants".
        this.TIME_TO_ANIMATE_COLOR        = 0.5;
        this.TIME_TO_ANIMATE_CAMERA_SHAKE = 0.5;

        // Color.
        this.initialColor         = BlockRandomColor();
        this.currentColor         = this.initialColor;
        this.targetColor          = this.initialColor;
        this.colorAnimationTime = 0;

        // Alive.
        this.alive                   = true;
        this.animatingDeath          = false;
        this.deathAnimationBlockTime = 0;

        // Camera.
        this.animatingCameraShake    = true;
        this.cameraAnimationTime     = 0;
        this.cameraShakeVector       = Vector_Create(0,0);
        this.cameraPos               = Vector_Create(0,0);

        // Control.
        this.dir              = dir;
        this.targetDir        = dir;
        this.moveCooldownTime = 0;

        // Blocks.
        this.blocks = [];
        for(let i = 0; i < size; ++i) {
            let b = new Block(
                x + (dir.x * i * -1),
                y + (dir.y * i * -1)
            );
            this.blocks.push(b);
        }
    }

    //--------------------------------------------------------------------------
    die()
    {
        this.alive = false;

        this.animatingDeath          = false;
        this.deathAnimationBlockTime = 0;
        this.timeToAnimateBlockDeath = 2 / this.blocks.length;

        this.animatingCameraShake = true;
        this.cameraAnimationTime  = 0;
    } // die

    //--------------------------------------------------------------------------
    changeColor(color)
    {
        this.initialColor       = this.currentColor;
        this.targetColor        = color;
        this.colorAnimationTime = 0;

        UpdateFieldShadow();
    } // changeColor


    //--------------------------------------------------------------------------
    move(dt)
    {
        //
        // Check for the new direction.
        if(Keyboard[KEY_LEFT] && this.dir.x == 0) {
            this.targetDir = Vector_Create(-1, 0);
        } else if(Keyboard[KEY_RIGHT] && this.dir.x == 0) {
            this.targetDir = Vector_Create(+1, 0);
        } else if(Keyboard[KEY_UP] && this.dir.y == 0) {
            this.targetDir = Vector_Create(0, -1);
        } else if(Keyboard[KEY_DOWN] && this.dir.y == 0) {30
            this.targetDir = Vector_Create(0, +1);
        }
        //
        // Move
        this.moveCooldownTime += dt;
        if(this.alive && this.moveCooldownTime > SNAKE_TIME_TO_MOVE) {
            this.moveCooldownTime = 0;
            this.dir = this.targetDir;

            //
            // The trick is pretty simple:
            //    Remove the tail.
            //    Add the head position with the current direction
            //    Make the removed tail be positioned on the new direction.
            //    Make the removed tail be the new head ;D
            let head    = Array_GetFront(this.blocks);
            let new_pos = Vector_Add(head.position, this.dir);

            let tail = Array_PopBack(this.blocks);

            trail.add(tail.position.x, tail.position.y);
            tail.position = new_pos;

            Array_PushFront(this.blocks, tail);


            //
            // Check bounds.
            head = Array_GetFront(this.blocks);
            // Horizontal
            if(head.position.x < leftEdge) {
                head.position.x = rightEdge-1;
            } else if(head.position.x >= rightEdge) {
                head.position.x = leftEdge;
            }

            // Vertical
            if(head.position.y < topEdge) {
                head.position.y = bottomEdge-1;
            } else if(head.position.y >= bottomEdge) {
                head.position.y = topEdge;
            }
        }
    } // move

    //--------------------------------------------------------------------------
    grow()
    {
        let tail = Array_GetBack(this.blocks);
        let new_block = new Block(tail.position.x, tail.position.y);
        this.blocks.push(new_block);
    } // grow

    //--------------------------------------------------------------------------
    checkCollisionBody()
    {
        let head_pos = Array_GetFront(this.blocks).position;
        for(let i = 1, len = this.blocks.length; i < len; ++i) {
            let block_pos = this.blocks[i].position;
            if(head_pos.x == block_pos.x && head_pos.y == block_pos.y) {
                this.die();
                // Calculate the direction between the head and the hit block.
                this.cameraShakeVector = Vector_Sub(
                    block_pos,
                    this.blocks[1].position // Use the next to head block.
                );

                return;
            }
        }
    } // checkCollisionBody

    //--------------------------------------------------------------------------
    update(dt)
    {
        if(this.alive) {
            this.move(dt);
            this.checkCollisionBody();
        }

        //
        // Animate Color.
        if(this.alive                            &&
           this.currentColor != this.targetColor &&
           this.colorAnimationTime < this.TIME_TO_ANIMATE_COLOR)
        {
            this.colorAnimationTime = Math_Clamp(
                0,
                this.TIME_TO_ANIMATE_COLOR,
                this.colorAnimationTime + dt
            );

            this.currentColor = chroma.mix(
                chroma(this.initialColor.hex()),
                chroma(this.targetColor .hex()),
                this.colorAnimationTime / this.TIME_TO_ANIMATE_COLOR
            );
        }

        //
        // Animate Death.
        if(!this.alive) {
            // Camera Shake
            if(this.animatingCameraShake) {
                this.cameraAnimationTime = Math_Clamp(
                    0,
                    this.TIME_TO_ANIMATE_CAMERA_SHAKE,
                    this.cameraAnimationTime + dt
                );

                if(this.cameraAnimationTime >= this.TIME_TO_ANIMATE_CAMERA_SHAKE) {
                    this.animatingCameraShake = false;
                    this.animatingDeath       = true;

                    this.cameraPos.x = 0;
                    this.cameraPos.y = 0;
                } else {
                    // @todo(stdmatt): Remove the magic values.
                    let t = Ease_OutElastic(
                        this.cameraAnimationTime / this.TIME_TO_ANIMATE_CAMERA_SHAKE,
                        -10,
                        +10,
                        1
                    );

                    this.cameraPos.x = this.cameraShakeVector.x * t;
                    this.cameraPos.y = this.cameraShakeVector.y * t;
                }
            }
            // Blocks Death
            else if(this.animatingDeath) {
                if(this.blocks.length != 0) {
                    let b = Array_GetBack(this.blocks);
                    if(b.scale <= 0) {
                        Array_PopBack(this.blocks);
                        this.deathAnimationBlockTime = 0;
                    } else {
                        this.deathAnimationBlockTime = Math_Clamp(
                            0,
                            this.timeToAnimateBlockDeath,
                            this.deathAnimationBlockTime + dt
                        );

                        b.scale = Math_Lerp(
                            1,
                            0,
                            this.deathAnimationBlockTime / this.timeToAnimateBlockDeath
                        );
                    }
                } else {
                    this.animatingDeath = false;
                }
            }
            // Animation done.
            else {
                this.animatingDeath = false;
            }
        } // if(!this.alive)
    } // update

    //--------------------------------------------------------------------------
    draw()
    {
        Canvas_Push();
            Canvas_Translate(this.cameraPos.x, this.cameraPos.y);

            for(let i = this.blocks.length-1; i >= 0; --i) {
                let b = this.blocks[i];
                DrawBlock(
                    b.position.x,
                    b.position.y,
                    this.currentColor,
                    b.scale,
                    b.rotation
                );
            }
        Canvas_Pop();
    } // draw
}; // class Snake


//----------------------------------------------------------------------------//
// Food                                                                       //
//----------------------------------------------------------------------------//
class Food
{
    //--------------------------------------------------------------------------
    constructor(x, y)
    {
        this.TIME_TO_ANIMATE_CREATION = 0.5;
        this.INITIAL_SCALE            = 5;

        this.block                 = new Block(x, y);
        this.color                 = BlockRandomColor();
        this.creationAnimationTime = 0;

        this.block.scale = this.INITIAL_SCALE;
    } // constructor

    //--------------------------------------------------------------------------
    update(dt)
    {
        if(this.creationAnimationTime >= this.TIME_TO_ANIMATE_CREATION) {
            return;
        }

        this.creationAnimationTime = Math_Clamp(
            0,
            this.TIME_TO_ANIMATE_CREATION,
            this.creationAnimationTime + dt
        );

        this.block.scale = Math_Lerp(
            this.INITIAL_SCALE,
            1,
            this.creationAnimationTime / this.TIME_TO_ANIMATE_CREATION
        );

        this.block.rotation = Math_Lerp(
            0,
            MATH_2PI,
            this.creationAnimationTime / this.TIME_TO_ANIMATE_CREATION
        );
    } // update(dt)

    //--------------------------------------------------------------------------
    draw()
    {
        DrawBlock(
            this.block.position.x,
            this.block.position.y,
            this.color,
            this.block.scale,
            this.block.rotation
        );
    } // draw
}; // class Food


//----------------------------------------------------------------------------//
// Field                                                                      //
//----------------------------------------------------------------------------//
class Field
{
    constructor()
    {
        this.points = [];
        for(let i = leftEdge; i < rightEdge; ++i) {
            for(let j = topEdge; j < bottomEdge; ++j) {
                this.points.push(Vector_Create(i, j));
            }
        }

        this.texture = document.createElement("canvas").getContext("2d");
        this.texture.canvas.width  = Canvas_Width;
        this.texture.canvas.height = Canvas_Height;
        this.texture.width  = Canvas_Width;
        this.texture.height = Canvas_Height;
    }

    updateTexture()
    {
        Canvas_SetRenderTarget(this.texture);
        Canvas_ClearWindow("black");

        for(let i = 0, len = this.points.length ; i < len; ++i) {
            // Point position.
            let px = this.points[i].x;
            let py = this.points[i].y;

            let total_rgb = chroma('black');
            for(let j = 0, food_len = foods.length; j < food_len; ++j) {
                // Food position.
                let sx = foods[j].block.position.x;
                let sy = foods[j].block.position.y;

                let dist       = Math_Distance(px, py, sx, sy);
                let luminance  = Math_Map(dist, 0, 10, 0.8, 0);

                let b = chroma(foods[j].color.get("hsl.h"), 1, luminance, 'hsl');
                total_rgb = chroma.mix(b, total_rgb, 0.5, "lrgb");
            } // food

            let tx = px * BLOCK_SIZE + Canvas_Half_Width;
            let ty = py * BLOCK_SIZE + Canvas_Half_Height;
            Canvas_Push();
                Canvas_SetStrokeStyle(total_rgb.hex());
                Canvas_Translate(tx, ty);
                Canvas_DrawLine(0, 0, BLOCK_SIZE, 0);
                Canvas_DrawLine(0, 0, 0, BLOCK_SIZE);
            Canvas_Pop();
        }

        Canvas_SetRenderTarget(null);
    }

    draw()
    {
        Canvas_Push();
            Canvas_Translate(-Canvas_Half_Width, -Canvas_Half_Height);
            CurrContext.drawImage(this.texture.canvas, 0, 0);
        Canvas_Pop();
    }
}; // class Field


//----------------------------------------------------------------------------//
// Trail                                                                      //
//----------------------------------------------------------------------------//
class TrailBlock
{
    constructor(x, y, color, duration)
    {
        this.position          = Vector_Create(x, y);
        this.color             = color;
        this.opacity           = 1;
        this.scale             = 1;
        this.animationDuration = duration;
        this.animationTime     = 0;

        this.finished = false;
    }

    update(dt)
    {
        if(this.finished) {
            return;
        }

        this.animationTime = Math_Clamp(
            0,
            this.animationDuration,
            this.animationTime + dt
        );

        if(this.animationTime >= this.animationDuration) {
            this.finished = true;
        }

        this.scale   = Math_Lerp(0.8, 0.2, this.animationTime / this.animationDuration);
        this.opacity = Math_Lerp(0.9, 0,   this.animationTime / this.animationDuration);
    }

    draw()
    {
        DrawBlock(
            this.position.x,
            this.position.y,
            this.color.alpha(this.opacity),
            this.scale,
            0
        );
    }

}; // class TrailBlock


class Trail
{
    constructor()
    {
        this.blocks = [];
    }

    add(x, y)
    {
        let block = new TrailBlock(x, y, snake.currentColor, 1);
        this.blocks.push(block);
    }

    addFood(x, y, color)
    {
        const R = 3;
        for(let i = -R; i < R; ++i) {
            let yi = y + i;

            for(let j = -R; j < R; ++j) {
                let xj = x + j;

                let dist = (R - Math_Distance(x, y, xj, yi)) / 1.5;
                let b    = new TrailBlock(xj, yi, color, dist);
                this.blocks.push(b);
            }
        }

        field.updateTexture();
    }


    update(dt)
    {
        for(let i = this.blocks.length-1; i >= 0; --i) {
            let b = this.blocks[i];
            b.update(dt);
            if(b.finished) {
                Array_RemoveAt(this.blocks, i);
            }
        }
    }

    draw()
    {
        for(let i = 0; i < this.blocks.length; ++i) {
            this.blocks[i].draw();
        }
    }
} // class Trail


//----------------------------------------------------------------------------//
// Setup / Draw                                                               //
//----------------------------------------------------------------------------//
//------------------------------------------------------------------------------
function InitializeCanvas()
{
    //
    // Configure the Canvas.
    const parent        = document.getElementById("canvas_div");
    const parent_width  = parent.clientWidth;
    const parent_height = parent.clientHeight;

    const max_side = Math_Max(parent_width, parent_height);
    const min_side = Math_Min(parent_width, parent_height);

    const ratio = min_side / max_side;

    // Landscape
    if(parent_width > parent_height) {
        Canvas_CreateCanvas(800, 800 * ratio, parent);
    }
    // Portrait
    else {
        Canvas_CreateCanvas(800 * ratio, 800, parent);
    }

    Canvas.style.width  = "100%";
    Canvas.style.height = "100%";
}

//------------------------------------------------------------------------------
function Setup()
{
    Random_Seed(null);
    InitializeCanvas();
    Input_InstallBasicKeyboardHandler();

    leftEdge   = Math_Int(Canvas_Edge_Left   / BLOCK_SIZE);
    rightEdge  = Math_Int(Canvas_Edge_Right  / BLOCK_SIZE);
    topEdge    = Math_Int(Canvas_Edge_Top    / BLOCK_SIZE);
    bottomEdge = Math_Int(Canvas_Edge_Bottom / BLOCK_SIZE);

    // @notice(stdmatt): Trick to make the canvas fits perfect with the game
    // field, since it might be not even divisible at first place.
    const resize_width  = (rightEdge  + Math_Abs(leftEdge)) * BLOCK_SIZE;
    const resize_height = (bottomEdge + Math_Abs(topEdge )) * BLOCK_SIZE;

    Canvas_Resize(resize_width, resize_height);

    RestartGame();
    Canvas_Draw(0);
}

//------------------------------------------------------------------------------
function Draw(dt)
{
    Canvas_ClearWindow("black");

    //
    // Update.
    trail.update(dt);
    snake.update(dt);
    for(let i = 0, len = foods.length; i < len; ++i) {
        foods[i].update(dt);
    }
    CheckSnakeFoodCollision(snake, foods);

    //
    // Game Over.
    if(!snake.alive && !snake.animatingDeath && !snake.animatingCameraShake) {
        RestartGame();
    }

    //
    // Draw.
    Canvas_Push();
        // let s = 0.8;
        // Canvas_Scale(s, s);
        // Canvas_SetFillStyle("red");
        // Canvas_FillRect(-200, -200, 400, 400);

        field.draw();
        trail.draw();
        snake.draw();
        for(let i = 0, len = foods.length; i < len; ++i) {
            foods[i].draw();
        }
    Canvas_Pop();

    Tween_Update(dt);
    if(shadow_anim_group) {
        shadow_anim_group.update(dt);
    }

}


//----------------------------------------------------------------------------//
// Input                                                                      //
//----------------------------------------------------------------------------//
function KeyPress(code)
{
    if(code == KEY_R) {
        RestartGame();
    }
}



//----------------------------------------------------------------------------//
// Entry Point                                                                //
//----------------------------------------------------------------------------//
Setup();
// Canvas_Setup({
//     main_title        : "Simple Snake",
//     main_date         : "Aug 10, 2019",
//     main_version      : "v1.0.1",
//     main_instructions : "<br><b>arrow keys</b> to move the snake<br><b>R</b> to start a new game.",
//     main_link: "<a href=\"http://stdmatt.com/demos/startfield.html\">More info</a>"
// });
